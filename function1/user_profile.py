class UserProfile:
    def __init__(self, username, first_name, last_name, email):
        self._username = username
        self._first_name = first_name
        self._last_name = last_name
        self._email = email

    def get_username(self):
        return self._username

    def get_email(self):
        return self._email

    def get_full_name(self):
        return f"{self._first_name} {self._last_name}"

    def update_email(self, new_email):
        if "@" not in new_email:
            return False
        self._email = new_email
        return True

    def get_profile_info(self):
        return {
            "username": self._username,
            "full_name": self.get_full_name(),
            "email": self._email
        }