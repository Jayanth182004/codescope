from typing import Generic, TypeVar, Optional, List
from pydantic import BaseModel

T = TypeVar('T')

class APIEnvelope(BaseModel, Generic[T]):
    success: bool
    message: str
    data: Optional[T] = None
    errors: List[str] = []
