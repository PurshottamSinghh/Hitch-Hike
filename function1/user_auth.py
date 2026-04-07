from datetime import datetime
import hashlib
import os

class UserAuth:
    def __init__(self):
        # In production this would connect to your real database
        self._users = {}        # { username: { password_hash, email, salt } }
        self._logged_in = set() # currently active sessions

    def _hash_password(self, password, salt):
        return hashlib.sha256((password + salt).encode()).hexdigest()

    def register(self, username, password, email):
        if username in self._users:
            return False  # duplicate user
        if not self.validate_password(password):
            return False

        salt = os.urandom(16).hex()
        self._users[username] = {
            "password_hash": self._hash_password(password, salt),
            "salt": salt,
            "email": email
        }
        return True

    def login(self, username, password):
        if username not in self._users:
            return False

        user = self._users[username]
        hashed = self._hash_password(password, user["salt"])
        if hashed != user["password_hash"]:
            return False

        self._logged_in.add(username)
        return True

    def logout(self, username):
        self._logged_in.discard(username)

    def is_logged_in(self, username):
        return username in self._logged_in

    def update_password(self, username, old_password, new_password):
        if not self.login(username, old_password):
            return False
        if not self.validate_password(new_password):
            return False

        salt = os.urandom(16).hex()
        self._users[username]["password_hash"] = self._hash_password(new_password, salt)
        self._users[username]["salt"] = salt
        return True

    def validate_password(self, password):
        # At least 8 characters, 1 digit
        if len(password) < 8:
            return False
        if not any(c.isdigit() for c in password):
            return False
        return True