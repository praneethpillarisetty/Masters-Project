# COMPREHENSIVE SECURE FILE HANDLING WITH END-TO-END ENCRYPTION AND NO SERVER ACCESS

## Project Overview

This Flask-based web application is designed to meet the increasing demand for robust, end-to-end security in digital communication, especially in areas like social media and cloud storage services. It guarantees that user control over data—including posts, files, and other types of content—remains independent of servers and cloud storage providers.

### Key Features:
- **End-to-End Encryption**: Files are encrypted before uploading and only the end user has the decryption key, ensuring data security both in transit and at rest.
- **User-Centric Data Control**: Data is never accessible to middlemen such as hosting servers or cloud providers, thanks to this serverless access control model.
- **Secure File Handling**: Users can upload, share, and access files with encryption, ensuring that sensitive information remains confidential.
- **Comprehensive User Management**: The application includes functionalities for user registration, login, post sharing, file uploads, and file search.
- **Strict Privacy & Security**: Confidentiality and integrity are prioritized with cutting-edge encryption techniques, giving users complete control over their data.

This application sets a new standard for secure data management, offering users a powerful yet user-friendly platform for file and post sharing with strong privacy and encryption protections.

## Table of Contents
- [Project Overview](#project-overview)
- [Folder Structure](#folder-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Features](#features)
- [Contributors](#contributing)

## Folder Structure

Ensure that your project adheres to the following structure for smooth operation of the Flask application:

- `app.py`: The main application file for the Flask server.
- `serviceAccountKey.json`: Firebase service account key (can be downloaded from the Firebase Console).
- `instance/`: Holds configuration and instance-specific files.
- `static/`: Stores CSS, JavaScript, and image files used by the application.
- `templates/`: Contains all the HTML templates for the Flask views.

## Installation

To set up the application, follow the steps below.

### Step 1: Clone the Repository

```bash
git clone https://github.com/praneethpillarisetty/Masters-Project.git
cd Masters-Project
```

### Step 2: Install Dependencies
```bash
pip install Flask Flask-SQLAlchemy Flask-Login APScheduler firebase-admin hurry.filesize
```
### Step 3: Set Up Firebase
- Download the Firebase service account key (serviceAccountKey.json) from the Firebase Console.
- Place the dowloaded file in the root of your project directory.
  
## Usage
To start the Flask application, simply run:
```bash
python app.py
```
Once the application starts running open the `127.0.0.1:5000` to find the index page.
## Features
- Registration & Login: Users can securely register and log in using credentials.
- File Uploads: Files are encrypted before uploading and stored in Firebase Storage.
- File Search & Access Control: Users can search for files by tags or description and request access for secure sharing.
- Profile Management: Users can view and update their profile information, such as email and password.
- File Sharing & Requests: Request file access, and securely share files using public/private keys.

## Contributors

| Name                                        | Role          |
|---------------------------------------------|---------------|
| **Venkata Satya Sai Praneeth Pillarisetty** | Developer     |
| **Dr. Ouyang, Jinsong**                     | 1st Reader    |
| **Dr. Syed Badruddoja**                     | 2nd Reader    |



