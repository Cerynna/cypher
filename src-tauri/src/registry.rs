use std::collections::HashMap;

pub type SessionId = u32;

pub struct Registry<T> {
    next_id: SessionId,
    entries: HashMap<SessionId, T>,
}

impl<T> Default for Registry<T> {
    fn default() -> Self {
        Self {
            next_id: 1,
            entries: HashMap::new(),
        }
    }
}

impl<T> Registry<T> {
    pub fn insert(&mut self, entry: T) -> SessionId {
        let id = self.next_id;
        self.next_id += 1;
        self.entries.insert(id, entry);
        id
    }

    pub fn get_mut(&mut self, id: SessionId) -> Option<&mut T> {
        self.entries.get_mut(&id)
    }

    pub fn remove(&mut self, id: SessionId) -> Option<T> {
        self.entries.remove(&id)
    }

    pub fn clear(&mut self) {
        self.entries.clear();
    }

    #[cfg(test)]
    pub fn len(&self) -> usize {
        self.entries.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attribue_des_identifiants_uniques_et_croissants() {
        let mut registry = Registry::default();
        let first = registry.insert("a");
        let second = registry.insert("b");
        assert_ne!(first, second);
        assert_eq!(registry.len(), 2);
    }

    #[test]
    fn ne_reutilise_pas_un_identifiant_libere() {
        let mut registry = Registry::default();
        let first = registry.insert("a");
        registry.remove(first);
        assert_ne!(registry.insert("b"), first);
    }

    #[test]
    fn retire_et_vide_les_sessions() {
        let mut registry = Registry::default();
        let id = registry.insert(String::from("a"));
        registry.get_mut(id).unwrap().push('!');
        assert_eq!(registry.remove(id).as_deref(), Some("a!"));
        registry.insert(String::from("b"));
        registry.clear();
        assert_eq!(registry.len(), 0);
    }
}
