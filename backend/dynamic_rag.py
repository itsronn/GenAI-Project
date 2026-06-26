import chromadb
import wikipedia
import re

chroma_client = chromadb.EphemeralClient()


def clean_collection_name(claim: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9]', '', claim)
    if len(cleaned) < 3:
        cleaned += "collection"
    return cleaned[:45]


def build_dynamic_context(claim: str, num_paragraphs: int = 4) -> str:
    collection_name = clean_collection_name(claim)
    collection = chroma_client.get_or_create_collection(name=collection_name)

    try:
        search_results = wikipedia.search(claim, results=2)
        if not search_results:
            return "No background facts found."

        all_chunks = []
        all_ids = []

        for article_title in search_results:
            try:
                page = wikipedia.page(article_title, auto_suggest=False)
                paragraphs = page.content.split("\n\n")

                for i, para in enumerate(paragraphs):
                    cleaned_para = para.strip()
                    if len(cleaned_para) > 60 and not cleaned_para.startswith("=="):
                        all_chunks.append(cleaned_para)
                        all_ids.append(f"{clean_collection_name(article_title)}_{i}")
            except Exception:
                continue

        if all_chunks:
            collection.add(documents=all_chunks, ids=all_ids)

            results = collection.query(
                query_texts=[claim],
                n_results=num_paragraphs
            )

            if results and 'documents' in results and results['documents'][0]:
                return "\n\n---\n\n".join(results['documents'][0])

    except Exception as e:
        print(f"[RAG Error] Pipeline execution failed: {e}")

    return "No baseline reference facts could be retrieved dynamically."
