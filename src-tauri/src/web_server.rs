use crate::docker;
use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tiny_http::{Header, Method, Response, Server, StatusCode};

#[derive(Default)]
pub struct RuntimeConfig {
    pub enabled: bool,
    pub password: String,
    pub sessions: HashSet<String>,
}

pub type SharedConfig = Arc<Mutex<RuntimeConfig>>;

pub struct ServerHandle {
    pub port: u16,
    stop_flag: Arc<AtomicBool>,
    thread: std::thread::JoinHandle<()>,
}

impl ServerHandle {
    pub fn stop(self) {
        self.stop_flag.store(true, Ordering::SeqCst);
        let _ = self.thread.join();
    }
}

pub fn start(port: u16, frontend_dir: PathBuf, config: SharedConfig) -> Result<ServerHandle, String> {
    let address = format!("0.0.0.0:{port}");
    let server = bind_with_retry(&address)
        .map_err(|err| format!("Impossible d'écouter sur {address} : {err}"))?;

    let stop_flag = Arc::new(AtomicBool::new(false));
    let thread_stop_flag = stop_flag.clone();

    let thread = std::thread::spawn(move || loop {
        if thread_stop_flag.load(Ordering::SeqCst) {
            break;
        }

        match server.recv_timeout(Duration::from_millis(500)) {
            Ok(Some(request)) => handle_request(request, &config, &frontend_dir),
            Ok(None) => continue, // timeout écoulé, on reboucle pour vérifier le drapeau
            Err(_) => break,
        }
    });

    Ok(ServerHandle {
        port,
        stop_flag,
        thread,
    })
}

fn bind_with_retry(address: &str) -> Result<Server, String> {
    const ATTEMPTS: u32 = 6;
    let mut last_error = String::new();

    for attempt in 0..ATTEMPTS {
        match Server::http(address) {
            Ok(server) => return Ok(server),
            Err(err) => {
                last_error = err.to_string();
                if attempt + 1 < ATTEMPTS {
                    std::thread::sleep(Duration::from_millis(300));
                }
            }
        }
    }

    Err(last_error)
}

fn text_response(body: impl Into<String>, status: u16) -> Response<std::io::Cursor<Vec<u8>>> {
    let header = Header::from_bytes(&b"Content-Type"[..], &b"text/plain; charset=utf-8"[..]).unwrap();
    Response::from_string(body.into())
        .with_status_code(StatusCode(status))
        .with_header(header)
}

fn json_response(body: serde_json::Value, status: u16) -> Response<std::io::Cursor<Vec<u8>>> {
    let header = Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
    Response::from_string(body.to_string())
        .with_status_code(StatusCode(status))
        .with_header(header)
}

fn handle_request(request: tiny_http::Request, config: &SharedConfig, frontend_dir: &Path) {
    let enabled = config.lock().unwrap().enabled;

    if !enabled {
        let _ = request.respond(text_response("Accès web désactivé.", 503));
        return;
    }

    let method = request.method().clone();
    let url = request.url().to_string();

    if let Some(rest) = url.strip_prefix("/api/") {
        handle_api(request, &method, rest, config);
    } else {
        handle_static(request, &url, frontend_dir);
    }
}

fn generate_token() -> String {
    let bytes: [u8; 32] = rand::random();
    bytes.iter().map(|b| format!("{b:02x}")).collect()
}

fn session_token(request: &tiny_http::Request) -> Option<String> {
    let header = request.headers().iter().find(|h| h.field.equiv("Cookie"))?;
    header
        .value
        .as_str()
        .split(';')
        .map(|part| part.trim())
        .find_map(|part| part.strip_prefix("wraith_session="))
        .map(|v| v.to_string())
}

fn is_authorized(request: &tiny_http::Request, config: &SharedConfig) -> bool {
    let cfg = config.lock().unwrap();
    if cfg.password.is_empty() {
        return true;
    }
    match session_token(request) {
        Some(token) => cfg.sessions.contains(&token),
        None => false,
    }
}

fn handle_api(request: tiny_http::Request, method: &Method, rest: &str, config: &SharedConfig) {
    let segments: Vec<&str> = rest.split('/').filter(|s| !s.is_empty()).collect();

    match (method, segments.as_slice()) {
        (Method::Post, ["login"]) => return handle_login(request, config),
        (Method::Post, ["logout"]) => return handle_logout(request, config),
        (Method::Get, ["session"]) => return handle_session(request, config),
        _ => {}
    }

    if !is_authorized(&request, config) {
        let _ = request.respond(json_response(serde_json::json!({ "error": "unauthorized" }), 401));
        return;
    }

    let result: Result<Option<String>, String> = match (method, segments.as_slice()) {
        (Method::Get, ["containers"]) => docker::ps().map(Some),
        (Method::Post, ["containers", id, "start"]) => docker::start(id).map(|_| None),
        (Method::Post, ["containers", id, "stop"]) => docker::stop(id).map(|_| None),
        (Method::Post, ["containers", id, "restart"]) => docker::restart(id).map(|_| None),
        (Method::Delete, ["containers", id]) => docker::remove(id).map(|_| None),
        _ => {
            let _ = request.respond(text_response("Route inconnue.", 404));
            return;
        }
    };

    match result {
        Ok(Some(raw)) => {
            let body = serde_json::json!({ "raw": raw }).to_string();
            let header =
                Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap();
            let response = Response::from_string(body).with_header(header);
            let _ = request.respond(response);
        }
        Ok(None) => {
            let _ = request.respond(text_response("OK", 200));
        }
        Err(err) => {
            let _ = request.respond(text_response(err, 500));
        }
    }
}

fn handle_login(mut request: tiny_http::Request, config: &SharedConfig) {
    let mut body = String::new();
    if request.as_reader().read_to_string(&mut body).is_err() {
        let _ = request.respond(json_response(serde_json::json!({ "ok": false }), 400));
        return;
    }

    let submitted = serde_json::from_str::<serde_json::Value>(&body)
        .ok()
        .and_then(|v| v.get("password").and_then(|p| p.as_str()).map(str::to_string))
        .unwrap_or_default();

    let mut cfg = config.lock().unwrap();
    let ok = cfg.password.is_empty() || submitted == cfg.password;

    if !ok {
        drop(cfg);
        let _ = request.respond(json_response(serde_json::json!({ "ok": false }), 401));
        return;
    }

    let token = generate_token();
    cfg.sessions.insert(token.clone());
    drop(cfg);

    let cookie = Header::from_bytes(
        &b"Set-Cookie"[..],
        format!("wraith_session={token}; Path=/; SameSite=Lax").into_bytes(),
    )
    .unwrap();

    let response = json_response(serde_json::json!({ "ok": true }), 200).with_header(cookie);
    let _ = request.respond(response);
}

fn handle_logout(request: tiny_http::Request, config: &SharedConfig) {
    if let Some(token) = session_token(&request) {
        config.lock().unwrap().sessions.remove(&token);
    }

    let cookie =
        Header::from_bytes(&b"Set-Cookie"[..], &b"wraith_session=; Path=/; Max-Age=0"[..]).unwrap();
    let response = json_response(serde_json::json!({ "ok": true }), 200).with_header(cookie);
    let _ = request.respond(response);
}

fn handle_session(request: tiny_http::Request, config: &SharedConfig) {
    let authenticated = is_authorized(&request, config);
    let _ = request.respond(json_response(
        serde_json::json!({ "authenticated": authenticated }),
        200,
    ));
}

const MISSING_BUILD_MESSAGE: &str = "Le frontend n'a pas encore été buildé.\n\n\
Lance `npm run build` dans le dossier du projet, puis recharge cette page.";

fn handle_static(request: tiny_http::Request, url: &str, frontend_dir: &Path) {
    let relative = if url == "/" {
        "index.html"
    } else {
        url.trim_start_matches('/')
    };
    let mut path = frontend_dir.join(relative);

    if !path.is_file() {
        path = frontend_dir.join("index.html");
    }

    if !path.is_file() {
        let _ = request.respond(text_response(MISSING_BUILD_MESSAGE, 503));
        return;
    }

    match std::fs::File::open(&path) {
        Ok(file) => {
            let content_type = guess_content_type(&path);
            let header = Header::from_bytes(&b"Content-Type"[..], content_type.as_bytes()).unwrap();
            let response = Response::from_file(file).with_header(header);
            let _ = request.respond(response);
        }
        Err(_) => {
            let _ = request.respond(text_response("Fichier introuvable.", 404));
        }
    }
}

fn guess_content_type(path: &Path) -> &'static str {
    match path.extension().and_then(|e| e.to_str()) {
        Some("html") => "text/html; charset=utf-8",
        Some("js") => "text/javascript; charset=utf-8",
        Some("css") => "text/css; charset=utf-8",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("ico") => "image/x-icon",
        Some("json") => "application/json",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}
