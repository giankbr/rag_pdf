import json
from typing import Any

import mysql.connector

from app.config import settings


def get_connection():
    return mysql.connector.connect(
        host=settings.mysql_host,
        port=settings.mysql_port,
        user=settings.mysql_user,
        password=settings.mysql_password,
        database=settings.mysql_database,
    )


def init_schema() -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS documents (
            id INT AUTO_INCREMENT PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS chunks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            document_id INT NOT NULL,
            page_number INT NOT NULL,
            chunk_index INT NOT NULL,
            content TEXT NOT NULL,
            embedding_json JSON NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES documents(id)
        )
        """
    )
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS faqs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            document_id INT NOT NULL,
            question TEXT NOT NULL,
            answer TEXT NOT NULL,
            source_page INT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (document_id) REFERENCES documents(id)
        )
        """
    )
    conn.commit()
    cur.close()
    conn.close()


def insert_chunk(
    document_id: int,
    page_number: int,
    chunk_index: int,
    content: str,
    embedding: list[float],
) -> None:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        """
        INSERT INTO chunks (document_id, page_number, chunk_index, content, embedding_json)
        VALUES (%s, %s, %s, %s, %s)
        """,
        (document_id, page_number, chunk_index, content, json.dumps(embedding)),
    )
    conn.commit()
    cur.close()
    conn.close()


def fetch_all_chunks() -> list[dict[str, Any]]:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    cur.execute("SELECT * FROM chunks")
    rows = cur.fetchall()
    cur.close()
    conn.close()
    return rows
