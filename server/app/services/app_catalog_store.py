from app.models.app_catalog import AppCatalogItem
from app.services.state_backend import StateBackend


class InMemoryAppCatalogStore:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._catalog: dict[str, list[AppCatalogItem]] = {}
        self._restore_state()

    def reset(self) -> None:
        self._catalog = {}
        self._persist()

    def update_catalog(self, device_id: str, items: list[AppCatalogItem]) -> list[AppCatalogItem]:
        self._catalog[device_id] = [item.model_copy(deep=True) for item in items]
        self._persist()
        return self.get_catalog(device_id)

    def get_catalog(self, device_id: str) -> list[AppCatalogItem]:
        return [item.model_copy(deep=True) for item in self._catalog.get(device_id, [])]

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_state = self._state_backend.read_section("app_catalog", {})
        self._catalog = {
            device_id: [AppCatalogItem.model_validate(item) for item in items]
            for device_id, items in raw_state.items()
            if isinstance(device_id, str) and isinstance(items, list)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "app_catalog",
            {
                device_id: [item.model_dump(mode="json") for item in items]
                for device_id, items in self._catalog.items()
            },
        )
