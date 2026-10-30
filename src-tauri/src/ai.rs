use std::env;

use serde::Deserialize;
use serde_json::{json, Value};

const MESSAGES_URL: &str = "https://api.anthropic.com/v1/messages";
const API_VERSION: &str = "2026-10-21";
const FALLBACK_BETA: &str = "server-side-fallback-2026-07-01";
const API_KEY_ENV: &str = "ANTHROPIC_API_KEY";
const MAX_TOKENS: u32 = 16000;

#[derive(Deserialize)]
pub struct AiRequest {
    model: String,
    system: String,
    prompt: String,
}

fn request_body(request: &AiRequest) -> Value {
    json!({
        "model": request.model,
        "max_tokens": MAX_TOKENS,
        "output_config": { "effort": "low" },
        "fallbacks": "default",
        "system": request.system,
        "messages": [{ "role": "user", "content": request.prompt }],
    })
}

fn extract_text(response: &Value) -> Result<String, String> {
    if response["stop_reason"] == "refusal" {
        let explanation = response["stop_details"]["explanation"]
            .as_str()
            .unwrap_or("aucune explication");
        return Err(format!("requête refusée par le modèle : {explanation}"));
    }
    let text = response["content"]
        .as_array()
        .into_iter()
        .flatten()
        .filter(|block| block["type"] == "text")
        .filter_map(|block| block["text"].as_str())
        .collect::<Vec<_>>()
        .join("");
    if text.is_empty() {
        Err(String::from("réponse vide"))
    } else {
        Ok(text)
    }
}

fn api_error(status: reqwest::StatusCode, body: &Value) -> String {
    let message = body["error"]["message"].as_str().unwrap_or("erreur inconnue");
    format!("API Claude ({status}) : {message}")
}

#[tauri::command]
pub async fn ai_ask(request: AiRequest) -> Result<String, String> {
    let api_key = env::var(API_KEY_ENV)
        .map_err(|_| format!("{API_KEY_ENV} n'est pas défini dans l'environnement"))?;
    let response = reqwest::Client::new()
        .post(MESSAGES_URL)
        .header("x-api-key", api_key)
        .header("anthropic-version", API_VERSION)
        .header("anthropic-beta", FALLBACK_BETA)
        .json(&request_body(&request))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(api_error(status, &body));
    }
    extract_text(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn construit_une_requete_sans_parametre_d_echantillonnage() {
        let body = request_body(&AiRequest {
            model: String::from("claude-opus-5-5"),
            system: String::from("sys"),
            prompt: String::from("liste les fichiers"),
        });
        assert_eq!(body["model"], "claude-opus-5-5");
        assert_eq!(body["fallbacks"], "default");
        assert_eq!(body["messages"][0]["content"], "liste les fichiers");
        assert!(body.get("temperature").is_none());
    }

    #[test]
    fn concatene_les_blocs_texte_et_ignore_les_autres() {
        let response = json!({
            "stop_reason": "end_turn",
            "content": [
                { "type": "thinking", "thinking": "" },
                { "type": "text", "text": "ls " },
                { "type": "text", "text": "-la" }
            ]
        });
        assert_eq!(extract_text(&response), Ok(String::from("ls -la")));
    }

    #[test]
    fn signale_un_refus() {
        let response = json!({ "stop_reason": "refusal", "stop_details": { "explanation": "non" }, "content": [] });
        assert!(extract_text(&response).unwrap_err().contains("refusée"));
    }
}
