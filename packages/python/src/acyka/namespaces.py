"""Generated from openapi.json by tools/generate.ts. Do not edit."""

from __future__ import annotations

from typing import Any

from .aoperations import AsyncAccount, AsyncCatalogue, AsyncLibrary, AsyncPeople, AsyncSocial
from .operations import Account, Catalogue, Library, People, Social


class Namespaces:
    """What a client hangs the generated groups off.

    Generated, so a tag the server adds arrives without anybody editing the
    client — and attribute access stays real rather than a lookup in a dict,
    which is what an editor needs to complete it.
    """

    def __init__(self, core: Any) -> None:
        self.account = Account(core)
        self.catalogue = Catalogue(core)
        self.people = People(core)
        self.library = Library(core)
        self.social = Social(core)


class AsyncNamespaces:
    def __init__(self, core: Any) -> None:
        self.account = AsyncAccount(core)
        self.catalogue = AsyncCatalogue(core)
        self.people = AsyncPeople(core)
        self.library = AsyncLibrary(core)
        self.social = AsyncSocial(core)
