let tooltip = document.getElementById('tooltip');
let tooltipDescription = document.getElementById('tooltip-description');
let tooltipTags = document.getElementById('tooltip-tags');
let tooltipSizes = document.getElementById('tooltip-size');
let tooltiplastmodified = document.getElementById('tooltip-last-modified');
let tooltiplocation = document.getElementById('tooltip-location');
let currentFolderPath = '';
let currentPath = [];
let showTimeout;
let currentPostId = null;

function showTooltip(event, description, tags, size, last_modified, location) {
        clearTimeout(showTimeout);

        showTimeout = setTimeout(() => {
        tooltipDescription.textContent = 'Description: ' + description;
        tooltipTags.textContent = 'Tags: ' + tags;
        tooltipSizes.textContent = 'Size: ' + size;
        tooltiplastmodified.textContent = 'Last modified: ' + last_modified;
        tooltiplocation.textContent = 'Location: ' + location;
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';         tooltip.style.top = (event.pageY + 10) + 'px';     }, 500); }

function sortTable(columnIndex) {
    const table = document.getElementById('file-table');
    const rows = Array.from(table.rows).slice(1);
    const isAscending = table.dataset.sortOrder === 'asc';
    rows.sort((a, b) => {
        const cellA = a.cells[columnIndex].innerText.toLowerCase();
        const cellB = b.cells[columnIndex].innerText.toLowerCase();

        if (cellA < cellB) return isAscending ? -1 : 1;
        if (cellA > cellB) return isAscending ? 1 : -1;
        return 0;
    });

    table.tBodies[0].append(...rows);
    table.dataset.sortOrder = isAscending ? 'desc' : 'asc';
}

function formatDate(date) {
    console.log(new Date(date));
    if (!(date instanceof Date)) {
        console.error('Invalid date object:', date);
        return 'Invalid date';
    }
    const pad = (num) => num.toString().padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);     const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function formatSize(sizeInBytes) {
    if (sizeInBytes >= 1024 * 1024 * 1024) {
        return Math.round(sizeInBytes / (1024 * 1024 * 1024)) + 'G';     } else if (sizeInBytes >= 1024 * 1024) {
        return Math.round(sizeInBytes / (1024 * 1024)) + 'M';     } else if (sizeInBytes >= 1024) {
        return Math.round(sizeInBytes / 1024) + 'K';     } else {
        return Math.round(sizeInBytes) + 'B';     }
}

function hideTooltip() {
        clearTimeout(showTimeout);

        tooltip.style.display = 'none';
}

let dropdownMenu = document.getElementById('dropdown-menu');

function showDropdown(event, type, id) {
    event.stopPropagation();
    if (type === 'post') {
        currentPostId = id;
    } else if (type === 'folder') {
        currentFolderPath = currentPath.join('/');
        currentFolderPath = currentFolderPath + '/' + id;
    }

    const x = event.pageX;
    const y = event.pageY;

        dropdownMenu.style.left = (x + 10) + 'px';     dropdownMenu.style.top = (y + 10) + 'px';     dropdownMenu.style.display = 'block';

        if (type === 'post') {
        document.getElementById('dropdown-delete').href = `/delete_post/${id}`;
        document.getElementById('dropdown-share').onclick = function () {
            openShareModal('post', id);
            return false;         };
    } else if (type === 'folder') {
        document.getElementById('dropdown-delete').href = `/delete_folder?folder_path=${encodeURIComponent(currentFolderPath)}`;
        document.getElementById('dropdown-share').onclick = function () {
            openShareModal('folder', currentFolderPath);
            return false;         };
    }
}

document.addEventListener('click', function (event) {
    if (!dropdownMenu.contains(event.target) && !event.target.closest('.dropdown-button')) {
        dropdownMenu.style.display = 'none';
    }
});

function openShareModal(type, identifier) {
    const modal = document.getElementById('share-modal');
    modal.style.display = 'block';
    modal.dataset.shareType = type;
    modal.dataset.sharePath = identifier;
}

document.getElementById('close-share-modal').onclick = function () {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';
    document.getElementById("search-bar").value = "";
    document.getElementById('share-modal').style.display = 'none';
};

document.getElementById('search-bar').addEventListener('input', async function () {
    const query = this.value;
    const response = await fetch(`/search_users?query=${encodeURIComponent(query)}`);
    const data = await response.json();
    updateSearchResults(data.users);
});

function updateSearchResults(users) {
    const resultsContainer = document.getElementById('search-results');
    resultsContainer.innerHTML = '';

    if (Array.isArray(users) && users.length > 0) {
        users.forEach(user => {
            const listItem = document.createElement('li');
            listItem.textContent = user.email;             listItem.style.cursor = 'pointer';
            listItem.onclick = function () {
                shareFileWithUser(user.id, document.getElementById('share-modal').dataset.sharePath, document.getElementById('share-modal').dataset.shareType);
            };
            resultsContainer.appendChild(listItem);
        });
    } else {
        resultsContainer.innerHTML = 'No users found.';
    }
    resultsContainer.style.display = 'block';
}

async function shareFileWithUser(userId, identifier, type) {
    const days = document.getElementById('share-duration').value; 
    let url;
    let postData;
    let encryptionKeys = [];

    if (type === 'post') {
        url = `/get_file_data/${identifier}`;
        postData = await (await fetch(url)).json();
        if (!postData.success) {
            alert(`Error: ${postData.message}`);
            return;
        }
        encryptionKeys.push(postData.encryption_key);
    } else if (type === 'folder') {
        url = `/get_folder_data/${identifier}`;
        postData = await (await fetch(url)).json();
        if (!postData.success) {
            alert(`Error: ${postData.message}`);
            return;
        }

                for (const file of postData.files) {
            encryptionKeys.push(file.encryption_key);
        }
    }

        const publicKey = await fetchPublicKey(userId);

        const privateKeyBase64 = localStorage.getItem(`privatekey_${currentUserEmail}`);
    const privateKey = await importPrivateKey(privateKeyBase64);
    let reEncryptedSymmetricKeys = [];
    for (const encryptionKey of encryptionKeys) {
        const decryptedSymmetricKey = await decryptSymmetricKey(privateKey, encryptionKey);
        const symmetricKey = await importSymmetricKey(decryptedSymmetricKey);

        const reEncryptedSymmetricKey = await encryptSymmetricKey(publicKey, symmetricKey);
        reEncryptedSymmetricKeys.push(arrayBufferToBase64(reEncryptedSymmetricKey));
    }

        const response = await fetch(`/share_${type}/${identifier}/${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            encryption_keys: reEncryptedSymmetricKeys,
            days: days
        })
    });

    if (response.ok) {
        alert('Item shared successfully!');
        document.getElementById('share-modal').style.display = 'none';
    } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.message || 'Cannot share item.'}`);
    }
}

async function fetchPublicKey(userId) {
    try {
                const response = await fetch(`/get_public_key/${userId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

                if (response.ok) {
            const data = await response.json();
            return data.public_key;
        } else {
            console.error('Failed to fetch public key.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching public key:', error);
        return null;
    }
}


const fileIcons = {
    'pdf': '<i class="fas fa-file-pdf"></i>',
    'doc': '<i class="fas fa-file-word"></i>',
    'docx': '<i class="fas fa-file-word"></i>',
    'xls': '<i class="fas fa-file-excel"></i>',
    'xlsx': '<i class="fas fa-file-excel"></i>',
    'ppt': '<i class="fas fa-file-powerpoint"></i>',
    'pptx': '<i class="fas fa-file-powerpoint"></i>',
    'txt': '<i class="fas fa-file-alt"></i>',
    'csv': '<i class="fas fa-file-csv"></i>',
    'zip': '<i class="fas fa-file-archive"></i>',
    'rar': '<i class="fas fa-file-archive"></i>',
    'jpg': '<i class="fas fa-file-image"></i>',
    'jpeg': '<i class="fas fa-file-image"></i>',
    'png': '<i class="fas fa-file-image"></i>',
    'gif': '<i class="fas fa-file-image"></i>',
    'mp4': '<i class="fas fa-file-video"></i>',
    'mp3': '<i class="fas fa-file-audio"></i>',
    'wav': '<i class="fas fa-file-audio"></i>',
    'html': '<i class="fas fa-file-code"></i>',
    'css': '<i class="fas fa-file-code"></i>',
    'js': '<i class="fas fa-file-code"></i>',
    'json': '<i class="fas fa-file-code"></i>',
    'xml': '<i class="fas fa-file-code"></i>',
    'java': '<i class="fas fa-file-code"></i>',
    'c': '<i class="fas fa-file-code"></i>',
    'cpp': '<i class="fas fa-file-code"></i>',
    'py': '<i class="fas fa-file-code"></i>',
    'default': '<i class="fas fa-file"></i>' };

function updateFileIcons() {
    document.querySelectorAll('.file-item').forEach(item => {
        const fileExtension = item.dataset.extension || 'default';

        const icon = fileIcons[fileExtension] || fileIcons['default'];
                item.innerHTML = icon + item.innerHTML;
    });

}

async function viewPost(postId) {
    try {
        const response = await fetch(`/get_file_data/${postId}`);
        const postData = await response.json();

        if (postData.error) {
            alert(postData.error);
            return;
        }

        try {
            if (postData.encryption_key && postData.encryption_key.trim() !== "") {
                const privateKeyBase64 = localStorage.getItem(`privatekey_${currentUserEmail}`);
                const publicKeyBase64 = localStorage.getItem(`publickey_${currentUserEmail}`);
                var publicKey = await importPublicKey(publicKeyBase64);
                if (postData.public_key != "") {
                    publicKey = await importPublicKey(postData.public_key);
                }
                const encryptedSymmetricKey = postData.encryption_key;
                const privateKey = await importPrivateKey(privateKeyBase64);
                const decryptedSymmetricKey = await decryptSymmetricKey(privateKey, encryptedSymmetricKey);
                const symmetricKey = await importSymmetricKey(decryptedSymmetricKey);
                const encryptedFileData = postData.encrypted_file_data;
                const fileData = await decryptFileContents(symmetricKey, encryptedFileData);

                if (fileData) {
                    const fileExtension = postData.data_type;
                    const isSignatureValid = await verifySignature(fileData, postData.digital_signature, publicKey);
                    if (isSignatureValid) {
                        openFileInNewPage(fileData, fileExtension);
                    } else {
                        alert("Invalid digital signature. The file may have been tampered with.");
                    }
                } else {
                    throw new Error("Decryption returned empty data");
                }
            } else {
                const fileData = hexToArrayBuffer(postData.encrypted_file_data);
                const fileExtension = postData.data_type;
                const publicKeyBase64 = localStorage.getItem(`publickey_${currentUserEmail}`);
                var publicKey = await importPublicKey(publicKeyBase64);
                if (postData.public_key != "") {
                    publicKey = await importPublicKey(postData.public_key);
                }
                const isSignatureValid = await verifySignature(new Uint8Array(fileData), postData.digital_signature, publicKey);
                if (isSignatureValid) {
                    openFileInNewPage(fileData, fileExtension);
                } else {
                    alert("Invalid digital signature. The file may have been tampered with.");
                }
            }
        } catch (error) {
            console.error("Error during file processing:", error);
            alert("Failed to process the file. Please check the console for details.");
        }
    } catch (error) {
        console.error("Error during file fetching:", error);
        alert("Failed to fetch the file data. Please check the console for details.");
    }
}

async function verifySignature(data, signatureBase64, publicKey) {
    try {
        const signature = base64ToArrayBuffer(signatureBase64);
        const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        return await crypto.subtle.verify(
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: { name: 'SHA-256' }
            },
            publicKey,
            signature,
            dataBuffer
        );
    } catch (error) {
        console.error("Error verifying signature:", error);
        throw error;
    }
}

async function importPublicKey(publicKeyBase64) {
    try {
        const publicKeyBuffer = base64ToArrayBuffer(publicKeyBase64);
        return await crypto.subtle.importKey(
            'spki',
            publicKeyBuffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: { name: 'SHA-256' }
            },
            true,
            ['verify']
        );
    } catch (error) {
        console.error("Error importing public key:", error);
        throw error;
    }
}


async function importPrivateKey(privateKeyBase64) {
    const privateKeyArrayBuffer = base64ToArrayBuffer(privateKeyBase64);
    return await window.crypto.subtle.importKey(
        'pkcs8',
        privateKeyArrayBuffer,
        { name: 'RSA-OAEP', hash: 'SHA-256' },
        true,
        ['decrypt']
    );
}

async function importSymmetricKey(symmetricKeyBase64) {
    return await window.crypto.subtle.importKey(
        'raw',
        symmetricKeyBase64,
        'AES-GCM',
        true,
        ['encrypt', 'decrypt']
    );
}

async function decryptSymmetricKey(privateKey, encryptedSymmetricKeyBase64) {
    const encryptedSymmetricKey = base64ToArrayBuffer(encryptedSymmetricKeyBase64);
    const decryptedSymmetricKey = await window.crypto.subtle.decrypt(
        { name: 'RSA-OAEP' },
        privateKey,
        encryptedSymmetricKey
    );
    return decryptedSymmetricKey;
}

async function importPublicKeyReencrypt(pem) {
    try {
        const binaryDerString = window.atob(pem);         const binaryDer = str2ab(binaryDerString);
        return window.crypto.subtle.importKey(
            'spki',
            binaryDer,
            {
                name: 'RSA-OAEP',
                hash: 'SHA-256'
            },
            true,
            ['encrypt']
        );
    } catch (e) {
        console.error("Error importing public key:", e);
        throw e;     }
}

async function encryptSymmetricKey(publicKeyString, symmetricKey) {
    const publicKey = await importPublicKeyReencrypt(publicKeyString);
    const exportedKey = await window.crypto.subtle.exportKey('raw', symmetricKey);
    return window.crypto.subtle.encrypt(
        { name: 'RSA-OAEP' },
        publicKey,
        exportedKey
    );
}

function str2ab(str) {
    const buf = new ArrayBuffer(str.length);
    const bufView = new Uint8Array(buf);
    for (let i = 0, strLen = str.length; i < strLen; i++) {
        bufView[i] = str.charCodeAt(i);
    }
    return buf;
}

async function decryptFileContents(key, encryptedFileDataHex) {
    try {
        const encryptedFileData = hexToArrayBuffer(encryptedFileDataHex);

                const iv = encryptedFileData.slice(0, 12);
        const encryptedContent = encryptedFileData.slice(12);

                const decryptedData = await window.crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            encryptedContent
        );

        return new Uint8Array(decryptedData);
    } catch (error) {
        console.error("Error decrypting file contents:", error);
        throw new Error("Failed to decrypt file contents");
    }
}

function base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

function hexToArrayBuffer(hex) {
    const bytes = new Uint8Array(Math.ceil(hex.length / 2));
    for (let i = 0; i < bytes.length; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes.buffer;
}

function symmetricKeysMatch(expectedKey, decryptedKey) {
    return expectedKey === decryptedKey;
}

function arrayBufferToBase64(buffer) {
    const byteArray = new Uint8Array(buffer);
    let byteString = '';
    for (let i = 0; i < byteArray.byteLength; i++) {
        byteString += String.fromCharCode(byteArray[i]);
    }
    return btoa(byteString);
}

function openFileInNewPage(fileData, fileExtension) {
    const blob = new Blob([fileData], { type: getMimeType(fileExtension) });
    const url = URL.createObjectURL(blob);
    window.open(url);
}

function getMimeType(extension) {
    const mimeTypes = {
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'csv': 'text/csv',
        'json': 'application/json',
        'xml': 'application/xml',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'application/javascript',
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'mp4': 'video/mp4',
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'webm': 'video/webm',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        'eot': 'application/vnd.ms-fontobject',
        'ttf': 'font/ttf',
        'otf': 'font/otf',
        'woff': 'font/woff',
        'woff2': 'font/woff2',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'webp': 'image/webp',
        'tiff': 'image/tiff',
        'ico': 'image/x-icon',
        'heif': 'image/heif',
        'heic': 'image/heic',
            };
    return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
}


function toggleFolder(folderId) {
    const folderContent = document.getElementById(folderId);
    if (folderContent.style.display === 'none') {
        folderContent.style.display = 'block';
    } else {
        folderContent.style.display = 'none';
    }
}

function navigateToPath(path) {
        const parts = path.split('/');
    currentPath = parts;
    updateFolderDisplay();
}

function readFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

async function generateSymmetricKey() {
    return window.crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 },
        true,
        ['encrypt', 'decrypt']
    );
}

async function encryptFileContents(key, contents) {
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encryptedContents = await window.crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        contents
    );
        const combinedData = new Uint8Array(iv.length + encryptedContents.byteLength);
    combinedData.set(iv, 0);
    combinedData.set(new Uint8Array(encryptedContents), iv.length);
    return combinedData;
}

async function signData(data, privateKeyBase64) {
    try {
                const encoder = new TextEncoder();
        const dataBuffer = encoder.encode(data);
        const privateKey = await importPrivateKeyForSigning(privateKeyBase64)
        console.log("Private key:", privateKey);
                const signature = await crypto.subtle.sign(
            {
                name: 'RSASSA-PKCS1-v1_5'
            },
            privateKey,
            dataBuffer
        );

        return arrayBufferToBase64(signature);
    } catch (error) {
        console.error("Error signing data:", error);
        throw error;
    }
}

async function importPrivateKeyForSigning(privateKeyBase64) {
    try {
                const privateKeyBuffer = base64ToArrayBuffer(privateKeyBase64);

                const privateKey = await crypto.subtle.importKey(
            'pkcs8',
            privateKeyBuffer,
            {
                name: 'RSASSA-PKCS1-v1_5',
                hash: { name: 'SHA-256' }
            },
            false,
            ['sign']
        );

        return privateKey;
    } catch (error) {
        console.error("Error importing private key for signing:", error);
        throw error;
    }
}

function upload_show(){
    const modal = document.getElementById('uploadModal');
    const uploadButton = document.getElementById('upload-button');
    const closeButton = document.getElementById('closeModal');

    uploadButton.addEventListener('click', function (event) {
        event.preventDefault();
        modal.style.display = 'block';
    });

        closeButton.addEventListener('click', function () {
        modal.style.display = 'none';
    });

    window.onclick = function (event) {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    };
}

async function revokeShare(postId, userId) {
    try {
        const response = await fetch(`/revoke_share/${postId}/${userId}`, {
            method: 'POST'
        });
        const result = await response.json();
        if (result.status) {
            alert('Access revoked successfully!');
        } else {
            alert('Failed to revoke access.');
        }
    } catch (error) {
        console.error('Error revoking share:', error);
        alert('Error revoking access.');
    }
}

async function extendShareTime(postId, userId) {
        let days = prompt('Enter the number of days to extend the expiration time:');

        days = parseInt(days, 10);

        if (isNaN(days) || days <= 0) {
        alert('Invalid input. Please enter a positive number of days.');
        return;
    }

    try {
        const response = await fetch(`/extend_share/${postId}/${userId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ days: days })
        });
        const result = await response.json();
        if (result.status === 'success') {
            alert('Time extended successfully!');
        } else {
            alert('Failed to extend time: ' + result.message);
        }
    } catch (error) {
        console.error('Error extending share time:', error);
        alert('Error extending time.');
    }
}