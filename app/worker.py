import asyncio
import logging


logger = logging.getLogger(__name__)


async def run() -> None:
    logger.info("worker_started")
    while True:
        await asyncio.sleep(5)


if __name__ == "__main__":
    asyncio.run(run())
