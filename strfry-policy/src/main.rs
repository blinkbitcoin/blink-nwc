use serde::{Deserialize, Serialize};
use std::io::{self, BufRead, Write};
use std::time::{SystemTime, UNIX_EPOCH};

const ALLOWED_KINDS: [u64; 5] = [13194, 23194, 23195, 23196, 23197];
const MAX_EVENT_LENGTH: usize = 100000;
const MAX_EVENT_AGE_SECONDS: i64 = 60 * 60 * 24;
const MAX_CLOCK_SKEW_SECONDS: i64 = 60 * 5;

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

fn current_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn validate_event(event: &Event) -> Result<(), String> {
    validate_event_at(event, current_unix_timestamp())
}

fn validate_event_at(event: &Event, now: i64) -> Result<(), String> {
    if !ALLOWED_KINDS.contains(&event.kind) {
        return Err(format!("blocked: kind {} not allowed", event.kind));
    }

    if event.created_at < now - MAX_EVENT_AGE_SECONDS {
        return Err(format!(
            "blocked: event too old ({} < {})",
            event.created_at,
            now - MAX_EVENT_AGE_SECONDS
        ));
    }

    if event.created_at > now + MAX_CLOCK_SKEW_SECONDS {
        return Err(format!(
            "blocked: event too far in future ({} > {})",
            event.created_at,
            now + MAX_CLOCK_SKEW_SECONDS
        ));
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

    fn create_test_event(kind: u64, content: &str, created_at: i64) -> Event {
        Event {
            id: "test123".to_string(),
            pubkey: "pubkey123".to_string(),
            created_at,
            kind,
            tags: vec![],
            content: content.to_string(),
            sig: "sig123".to_string(),
        }
    }

    #[test]
    fn test_allowed_kind_23194() {
        let now = 1_704_672_000;
        let event = create_test_event(23194, "test content", now);
        assert!(validate_event_at(&event, now).is_ok());
    }

    #[test]
    fn test_allowed_kind_23195() {
        let now = 1_704_672_000;
        let event = create_test_event(23195, "test content", now);
        assert!(validate_event_at(&event, now).is_ok());
    }

    #[test]
    fn test_allowed_kind_13194() {
        let now = 1_704_672_000;
        let event = create_test_event(13194, "test content", now);
        assert!(validate_event_at(&event, now).is_ok());
    }

    #[test]
    fn test_blocked_kind() {
        let now = 1_704_672_000;
        let event = create_test_event(1, "test content", now);
        let result = validate_event_at(&event, now);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("kind 1 not allowed"));
    }

    #[test]
    fn test_event_size_boundary() {
        let now = 1_704_672_000;
        let empty_event = create_test_event(23194, "", now);
        let base_size = serde_json::to_string(&empty_event).unwrap().len();
        let allowed_content_len = MAX_EVENT_LENGTH - base_size;

        let allowed_event = create_test_event(23194, &"x".repeat(allowed_content_len), now);
        assert!(validate_event_at(&allowed_event, now).is_ok());

        let oversized_event = create_test_event(23194, &"x".repeat(allowed_content_len + 1), now);
        let result = validate_event_at(&oversized_event, now);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("event too large"));
    }

    #[test]
    fn test_process_event_accept() {
        let event = create_test_event(23194, "test", super::current_unix_timestamp());
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
        let event = create_test_event(999, "test", super::current_unix_timestamp());
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
        let now = 1_704_672_000;
        for kind in ALLOWED_KINDS.iter() {
            let event = create_test_event(*kind, "test", now);
            assert!(
                validate_event_at(&event, now).is_ok(),
                "Kind {} should be allowed",
                kind
            );
        }
    }

    #[test]
    fn test_event_timestamp_boundaries() {
        let now = 1_704_672_000;

        let oldest_allowed = create_test_event(23194, "test", now - MAX_EVENT_AGE_SECONDS);
        let newest_allowed = create_test_event(23194, "test", now + MAX_CLOCK_SKEW_SECONDS);

        assert!(validate_event_at(&oldest_allowed, now).is_ok());
        assert!(validate_event_at(&newest_allowed, now).is_ok());
    }

    #[test]
    fn test_event_too_old() {
        let now = 1_704_672_000;
        let event = create_test_event(23194, "test", now - MAX_EVENT_AGE_SECONDS - 1);

        let result = validate_event_at(&event, now);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("event too old"));
    }

    #[test]
    fn test_event_too_far_in_future() {
        let now = 1_704_672_000;
        let event = create_test_event(23194, "test", now + MAX_CLOCK_SKEW_SECONDS + 1);

        let result = validate_event_at(&event, now);

        assert!(result.is_err());
        assert!(result.unwrap_err().contains("future"));
    }

    #[test]
    fn test_malformed_json_is_rejected() {
        let malformed = r#"{"type":"new","event":{"id":"abc""#;

        let result = serde_json::from_str::<Input>(malformed);

        assert!(result.is_err());
    }
}
