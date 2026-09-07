//! Generated from openapi.json by tools/generate.ts. Do not edit.

use crate::operations::*;

/// The namespaces a client carries.
///
/// Generated, so a tag the server adds arrives without anybody editing the
/// client — and each one is a real method rather than a lookup, which is what
/// an editor needs to complete it.
impl crate::Acyka {

    /// the account a token acts for
    pub fn account(&self) -> Account<'_> {
        Account { core: &self.core }
    }

    /// titles, people, characters and what is airing
    pub fn catalogue(&self) -> Catalogue<'_> {
        Catalogue { core: &self.core }
    }

    /// other people, as far as they have agreed to be read
    pub fn people(&self) -> People<'_> {
        People { core: &self.core }
    }

    /// somebody's own list and shelves
    pub fn library(&self) -> Library<'_> {
        Library { core: &self.core }
    }

    /// their writing, and who they read
    pub fn social(&self) -> Social<'_> {
        Social { core: &self.core }
    }
}
