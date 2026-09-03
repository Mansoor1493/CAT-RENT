from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    port: int = 8000
    mongodb_uri: str = "mongodb://localhost:27017/catrent"
    debug: bool = True

    class Config:
        env_prefix = "ML_"


settings = Settings()
