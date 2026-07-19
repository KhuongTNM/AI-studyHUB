import requests
import sys

if sys.platform.startswith('win'):
    sys.stdout.reconfigure(encoding='utf-8')

# Generate a unique email
import random
email = f"test_user_{random.randint(1000, 9999)}@gmail.com"
password = "Password123!"

register_payload = {
    "email": email,
    "displayName": "Test User",
    "password": password,
    "confirmPassword": password
}

print(f"Registering user with email: {email}")
reg_resp = requests.post("http://localhost:8080/api/auth/register", json=register_payload)
print("Register Status:", reg_resp.status_code)
if reg_resp.status_code != 201:
    print("Register Response:", reg_resp.text)
    sys.exit(1)

reg_data = reg_resp.json()
print("Register Response Data:", reg_data)
token = reg_data["accessToken"]
print("Token obtained successfully.")

# Prepare a dummy file
file_content = b"This is a dummy PDF file content. Just some random text."
files = {
    "file": ("test_doc.pdf", file_content, "application/pdf")
}
data = {
    "subject": "physics",
    "visibility": "private"
}
headers = {
    "Authorization": f"Bearer {token}"
}

print("Uploading document...")
upload_resp = requests.post(
    "http://localhost:8080/api/documents/upload",
    files=files,
    data=data,
    headers=headers
)
print("Upload Status:", upload_resp.status_code)
print("Upload Response:", upload_resp.text)

# Also test uploading with a folder ID
# First let's create a folder
create_folder_payload = {
    "name": "Physics Folder",
    "parentId": None,
    "subject": "physics"
}
print("Creating folder...")
folder_resp = requests.post(
    "http://localhost:8080/api/folders",
    json=create_folder_payload,
    headers=headers
)
print("Folder Status:", folder_resp.status_code)
if folder_resp.status_code == 201:
    folder_data = folder_resp.json()
    folder_id = folder_data["id"]
    print("Folder ID:", folder_id)
    
    # Upload to folder
    data_with_folder = {
        "subject": "physics",
        "visibility": "private",
        "folderId": folder_id
    }
    print("Uploading document to folder...")
    upload_resp2 = requests.post(
        "http://localhost:8080/api/documents/upload",
        files={
            "file": ("test_doc_in_folder.pdf", file_content, "application/pdf")
        },
        data=data_with_folder,
        headers=headers
    )
    print("Upload to Folder Status:", upload_resp2.status_code)
    print("Upload to Folder Response:", upload_resp2.text)
else:
    print("Folder response:", folder_resp.text)

