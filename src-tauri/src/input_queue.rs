use std::io::Write;
use std::sync::mpsc::{self, Sender};
use std::thread;

pub struct InputQueue(Sender<Vec<u8>>);

impl InputQueue {
    pub fn spawn(mut writer: Box<dyn Write + Send>) -> Self {
        let (sender, receiver) = mpsc::channel::<Vec<u8>>();
        thread::spawn(move || {
            while let Ok(bytes) = receiver.recv() {
                if writer.write_all(&bytes).and_then(|()| writer.flush()).is_err() {
                    break;
                }
            }
        });
        Self(sender)
    }

    pub fn push(&self, bytes: Vec<u8>) -> Result<(), String> {
        self.0
            .send(bytes)
            .map_err(|_| String::from("le shell n'accepte plus d'entrée"))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io;
    use std::sync::mpsc::Receiver;
    use std::sync::{Arc, Mutex};
    use std::time::{Duration, Instant};

    struct Recorder(Arc<Mutex<Vec<u8>>>);

    impl Write for Recorder {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            self.0.lock().unwrap().extend_from_slice(bytes);
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    struct BlockedUntilReleased(Receiver<()>);

    impl Write for BlockedUntilReleased {
        fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
            let _ = self.0.recv();
            Ok(bytes.len())
        }

        fn flush(&mut self) -> io::Result<()> {
            Ok(())
        }
    }

    fn wait_until(condition: impl Fn() -> bool) {
        let deadline = Instant::now() + Duration::from_secs(2);
        while !condition() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
        }
    }

    #[test]
    fn ecrit_les_entrees_dans_l_ordre_d_arrivee() {
        let written = Arc::new(Mutex::new(Vec::new()));
        let queue = InputQueue::spawn(Box::new(Recorder(Arc::clone(&written))));
        for chunk in ["l", "s", " ", "-la", "\r"] {
            queue.push(chunk.as_bytes().to_vec()).unwrap();
        }
        wait_until(|| written.lock().unwrap().len() == 7);
        assert_eq!(written.lock().unwrap().as_slice(), b"ls -la\r");
    }

    #[test]
    fn ne_bloque_pas_l_appelant_quand_le_programme_ne_lit_plus() {
        let (release, blocked) = mpsc::channel();
        let queue = InputQueue::spawn(Box::new(BlockedUntilReleased(blocked)));
        let started = Instant::now();
        for _ in 0..100 {
            queue.push(vec![b'x'; 64 * 1024]).unwrap();
        }
        assert!(started.elapsed() < Duration::from_millis(500));
        drop(release);
    }

    #[test]
    fn signale_une_erreur_quand_l_ecriture_a_echoue() {
        struct Broken;
        impl Write for Broken {
            fn write(&mut self, _: &[u8]) -> io::Result<usize> {
                Err(io::Error::from(io::ErrorKind::BrokenPipe))
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        let queue = InputQueue::spawn(Box::new(Broken));
        queue.push(b"a".to_vec()).unwrap();
        wait_until(|| queue.push(b"b".to_vec()).is_err());
        assert!(queue.push(b"c".to_vec()).is_err());
    }
}
