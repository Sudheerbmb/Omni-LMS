from typing import Generic, TypeVar

from pydantic import BaseModel, Field

from app.platform.config import settings

T = TypeVar("T")


class PageParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Page number (1-indexed)")
    page_size: int = Field(
        default=settings.default_page_size,
        ge=1,
        le=settings.max_page_size,
        description="Number of items per page",
    )

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.page_size

    @property
    def limit(self) -> int:
        return self.page_size


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def create(cls, items: list[T], total: int, params: PageParams) -> "Page[T]":
        pages = max(1, (total + params.page_size - 1) // params.page_size)
        return cls(
            items=items,
            total=total,
            page=params.page,
            page_size=params.page_size,
            pages=pages,
        )
