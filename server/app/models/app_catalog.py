from typing import Literal

from pydantic import BaseModel, Field

AppCatalogSource = Literal["manual", "shortcut", "start_menu", "program_files", "discovered"]


class AppCatalogItem(BaseModel):
    app_id: str
    display_name: str
    aliases: list[str] = Field(default_factory=list)
    linked: bool = True
    source: AppCatalogSource = "manual"


class AppCatalogSyncRequest(BaseModel):
    device_id: str
    items: list[AppCatalogItem] = Field(default_factory=list)


class AppCatalogResponse(BaseModel):
    device_id: str
    items: list[AppCatalogItem] = Field(default_factory=list)
