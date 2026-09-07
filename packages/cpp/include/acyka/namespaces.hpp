// Generated from openapi.json by tools/generate.ts. Do not edit.
#pragma once

#include <memory>
#include <utility>

#include "acyka/operations.hpp"

namespace acyka {

/// The namespaces a client carries.
///
/// Generated, so a tag the server adds arrives without anybody editing the
/// client — and each one is a real member rather than a lookup, which is what
/// an editor needs to complete it.
class namespaces {
    // Declared before the namespaces, because a member initialiser list runs
    // in declaration order and initialising this last would be a warning
    // about a field being set after the ones that were listed first.
    std::shared_ptr<core> core_;

 public:
    explicit namespaces(std::shared_ptr<core> core)
        : core_(core),
          account(core),
          catalogue(core),
          people(core),
          library(core),
          social(core) {}

    /// The transport these were built over.
    ///
    /// Held here rather than only in the client, so `pace()` can be asked
    /// without reaching through a namespace to find it.
    const std::shared_ptr<core>& shared_core() const { return core_; }

    /// the account a token acts for
    account_api account;
    /// titles, people, characters and what is airing
    catalogue_api catalogue;
    /// other people, as far as they have agreed to be read
    people_api people;
    /// somebody's own list and shelves
    library_api library;
    /// their writing, and who they read
    social_api social;
};

}  // namespace acyka
