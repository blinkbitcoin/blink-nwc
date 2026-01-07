use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};

const ALLOWED_KINDS: [u64; 5] = [13194, 23194, 23195, 23196, 23197];
const MAX_EVENT_LENGTH: usize = 100000;

#[derive(Deserialize, Debug)]
struct Input {
    #[serde(rename = "type")]
    msg_type: String,
    event: Event,
    #[serde(rename = "sourceType")]
    source_type: Option<String>,
    #[serde(rename = "sourceInfo")]
    source_info: Option<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
struct Event {
    id: String,
    pubkey: String,
    #[serde(rename = "created_at")]
    created_at: i64,
    kind: u64,
    tags: Vec<Vec<String>>,
    content: String,
    sig: String,
}

#[derive(Serialize, Debug, PartialEq)]
struct Output {
    id: String,
    action: String,
    msg: String,
}

fn validate_event(event: &Event) -> Result<(), String> {
    if !ALLOWED_KINDS.contains(&event.kind) {
        return Err(format!("blocked: kind {} not allowed", event.kind));
    }

    let event_json = serde_json::to_string(event).unwrap_or_default();
    if event_json.len() > MAX_EVENT_LENGTH {
        return Err(format!(
            "blocked: event too large ({} > {} bytes)",
            event_json.len(),
            MAX_EVENT_LENGTH
        ));
    }

    Ok(())
}

fn process_event(input: Input) -> Output {
    match validate_event(&input.event) {
        Ok(_) => Output {
            id: input.event.id.clone(),
            action: "accept".to_string(),
            msg: "".to_string(),
        },
        Err(msg) => Output {
            id: input.event.id.clone(),
            action: "reject".to_string(),
            msg,
        },
    }
}

fn main() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Error reading stdin: {}", e);
                continue;
            }
        };

        let input: Input = match serde_json::from_str(&line) {
            Ok(i) => i,
            Err(e) => {
                eprintln!("Error parsing JSON: {}", e);
                continue;
            }
        };

        let output = process_event(input);
        let output_json = serde_json::to_string(&output).unwrap();
        writeln!(stdout, "{}", output_json).unwrap();
        stdout.flush().unwrap();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_event(kind: u64, content: &str) -> Event {
        Event {
            id: "test123".to_string(),
            pubkey: "pubkey123".to_string(),
            created_at: 1704672000,
            kind,
            tags: vec![],
            content: content.to_string(),
            sig: "sig123".to_string(),
        }
    }

    #[test]
    fn test_allowed_kind_23194() {
        let event = create_test_event(23194, "test content");
        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_allowed_kind_23195() {
        let event = create_test_event(23195, "test content");
        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_allowed_kind_13194() {
        let event = create_test_event(13194, "test content");
        assert!(validate_event(&event).is_ok());
    }

    #[test]
    fn test_blocked_kind() {
        let event = create_test_event(1, "test content");
        let result = validate_event(&event);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("kind 1 not allowed"));
    }

    #[test]
    fn test_event_too_large() {
        let large_content = "x".repeat(MAX_EVENT_LENGTH);
        let event = create_test_event(23194, &large_content);
        let result = validate_event(&event);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("event too large"));
    }

    #[test]
    fn test_process_event_accept() {
        let event = create_test_event(23194, "test");
        let input = Input {
            msg_type: "new".to_string(),
            event: event.clone(),
            source_type: Some("IP4".to_string()),
            source_info: Some("127.0.0.1".to_string()),
        };

        let output = process_event(input);
        assert_eq!(output.action, "accept");
        assert_eq!(output.id, "test123");
        assert_eq!(output.msg, "");
    }

    #[test]
    fn test_process_event_reject() {
        let event = create_test_event(999, "test");
        let input = Input {
            msg_type: "new".to_string(),
            event: event.clone(),
            source_type: Some("IP4".to_string()),
            source_info: Some("127.0.0.1".to_string()),
        };

        let output = process_event(input);
        assert_eq!(output.action, "reject");
        assert_eq!(output.id, "test123");
        assert!(output.msg.contains("kind 999 not allowed"));
    }

    #[test]
    fn test_all_nwc_kinds() {
        for kind in ALLOWED_KINDS.iter() {
            let event = create_test_event(*kind, "test");
            assert!(validate_event(&event).is_ok(), "Kind {} should be allowed", kind);
        }
    }
}
