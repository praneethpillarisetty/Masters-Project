Comprehensive Secure File Handling with End-to-End Encryption and No Server Access
Project Overview
This Flask-based web application is designed to meet the increasing demand for robust, end-to-end security in digital communication, especially in areas like social media and cloud storage services. It guarantees that user control over data—including posts, files, and other types of content—remains independent of servers and cloud storage providers.

Key Features:
End-to-End Encryption: Files are encrypted before uploading and only the end user has the decryption key, ensuring data security both in transit and at rest.
User-Centric Data Control: Data is never accessible to middlemen such as hosting servers or cloud providers, thanks to this serverless access control model.
Secure File Handling: Users can upload, share, and access files with encryption, ensuring that sensitive information remains confidential.
Comprehensive User Management: The application includes functionalities for user registration, login, post sharing, file uploads, and file search.
Strict Privacy & Security: Confidentiality and integrity are prioritized with cutting-edge encryption techniques, giving users complete control over their data.
This application sets a new standard for secure data management, offering users a powerful yet user-friendly platform for file and post sharing with strong privacy and encryption protections.

Table of Contents
Project Overview
Folder Structure
Installation
Usage
Configuration
Features
Contributing
License
Folder Structure
Ensure that your project adheres to the following structure for smooth operation of the Flask application:

graphql
Copy code
├── app.py                     # Main Flask application
├── serviceAccountKey.json      # Firebase service account key
├── instance/                   # Configuration and instance-specific files
├── static/                     # Static assets (CSS, JavaScript, images)
│   ├── css/
│   ├── js/
├── templates/                  # HTML templates for Flask
│   ├── home.html
│   ├── login.html
│   ├── profile.html
│   ├── ...
└── README.md                   # This README file
app.py: The main application file for the Flask server.
serviceAccountKey.json: Firebase service account key (can be downloaded from the Firebase Console).
instance/: Holds configuration and instance-specific files.
static/: Stores CSS, JavaScript, and image files used by the application.
templates/: Contains all the HTML templates for the Flask views.
