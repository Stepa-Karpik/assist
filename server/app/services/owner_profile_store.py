from app.models.profile import OwnerProfile
from app.services.state_backend import StateBackend


class InMemoryOwnerProfileStore:
    def __init__(self, state_backend: StateBackend | None = None) -> None:
        self._state_backend = state_backend
        self._profiles: dict[str, OwnerProfile] = {}
        self._restore_state()

    def reset(self) -> None:
        self._profiles = {}
        self._persist()

    def get_profile(self, device_id: str) -> OwnerProfile:
        profile = self._profiles.get(device_id)
        return profile.model_copy(deep=True) if profile is not None else OwnerProfile()

    def save_profile(self, device_id: str, profile: OwnerProfile) -> OwnerProfile:
        self._profiles[device_id] = profile.model_copy(deep=True)
        self._persist()
        return self.get_profile(device_id)

    def _restore_state(self) -> None:
        if self._state_backend is None:
            return

        raw_state = self._state_backend.read_section("owner_profiles", {})
        self._profiles = {
            device_id: OwnerProfile.model_validate(value)
            for device_id, value in raw_state.items()
            if isinstance(device_id, str)
        }

    def _persist(self) -> None:
        if self._state_backend is None:
            return

        self._state_backend.write_section(
            "owner_profiles",
            {
                device_id: profile.model_dump(mode="json")
                for device_id, profile in self._profiles.items()
            },
        )
