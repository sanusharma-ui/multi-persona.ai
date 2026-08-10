"""
test_raven_emotion.py

Local test script - Raven persona, same user, 5-6 escalating messages
(negative -> positive), printing the emotion state + reply after every turn.

Run from your project root (jaha .env aur backend/ folder hai):
    python test_raven_emotion.py

ADJUST THE IMPORTS BELOW to match your actual folder structure -
maine tumhare groq_handler.py mein dekha `from backend.personas import ...`
hai, isliye "backend.groq_handler" assume kar raha hoon. Agar alag hai
to sirf ye 2 import lines badalna.
"""

from backend.groq_handler import generate_response
from backend.emotion.emotion_state import load_emotion_state

PERSONA = "raven"
USER_ID = "test_user_raven_001"

# Escalating: pehle neutral, phir negative, phir positive - taaki dono
# directions mein mood shift dikhe.
MESSAGES = [
    "Raven, seriously? You messed this up again.",
    "Don't talk to me like that. I'm really pissed off right now.",
    "Okay... I'm still angry, but let's fix this.",
]

def print_state(label: str):
    state = load_emotion_state(PERSONA, USER_ID)
    print(f"\n--- STATE [{label}] ---")
    for key in ("current_mood", "joy", "sadness", "anger", "frustration",
                "excitement", "trust", "comfort", "attachment", "patience",
                "energy", "burnout"):
        print(f"  {key}: {state.get(key)}")


def run():
    print_state("BEFORE (fresh/default)")

    for i, msg in enumerate(MESSAGES, start=1):
        print(f"\n{'='*50}")
        print(f"TURN {i} | USER: {msg}")
        reply = generate_response(
            user_message=msg,
            persona_key=PERSONA,
            user_id=USER_ID,
            user_ip="127.0.0.1",
        )
        print(f"RAVEN: {reply}")
        print_state(f"after turn {i}")


if __name__ == "__main__":
    run()