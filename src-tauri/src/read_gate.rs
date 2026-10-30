use std::sync::{Condvar, Mutex};

#[derive(Default)]
pub struct ReadGate {
    paused: Mutex<bool>,
    changed: Condvar,
}

impl ReadGate {
    pub fn set_paused(&self, paused: bool) {
        if let Ok(mut state) = self.paused.lock() {
            *state = paused;
            self.changed.notify_all();
        }
    }

    pub fn wait_until_open(&self) {
        let Ok(state) = self.paused.lock() else {
            return;
        };
        drop(self.changed.wait_while(state, |paused| *paused));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::thread;
    use std::time::Duration;

    #[test]
    fn laisse_passer_quand_la_lecture_n_est_pas_suspendue() {
        ReadGate::default().wait_until_open();
    }

    #[test]
    fn bloque_le_lecteur_jusqu_a_la_reprise() {
        let gate = Arc::new(ReadGate::default());
        gate.set_paused(true);
        let passed = Arc::new(AtomicBool::new(false));
        let reader = {
            let (gate, passed) = (Arc::clone(&gate), Arc::clone(&passed));
            thread::spawn(move || {
                gate.wait_until_open();
                passed.store(true, Ordering::SeqCst);
            })
        };
        thread::sleep(Duration::from_millis(50));
        assert!(!passed.load(Ordering::SeqCst));
        gate.set_paused(false);
        reader.join().unwrap();
        assert!(passed.load(Ordering::SeqCst));
    }
}
