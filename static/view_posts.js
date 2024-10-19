let tooltip = document.getElementById('tooltip');
let tooltipDescription = document.getElementById('tooltip-description');
let tooltipTags = document.getElementById('tooltip-tags');
let tooltipSizes = document.getElementById('tooltip-size');
let tooltiplastmodified = document.getElementById('tooltip-last-modified');

let showTimeout;

function showTooltip(event, description, tags, size, last_modified) {
    // Clear any previous show timeout to avoid multiple timeouts
    clearTimeout(showTimeout);

    // Set a timeout to display the tooltip with a delay
    showTimeout = setTimeout(() => {
        tooltipDescription.textContent = 'Description: ' + description;
        tooltipTags.textContent = 'Tags: ' + tags;
        tooltipSizes.textContent = 'Size: ' + size;
        tooltiplastmodified.textContent = 'Last modified: ' + last_modified;
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px'; // Position the tooltip 10px to the right of the mouse cursor
        tooltip.style.top = (event.pageY + 10) + 'px'; // Position the tooltip 10px below the mouse cursor
    }, 500); // 500ms delay for showing the tooltip
}

function hideTooltip() {
    // Clear any show timeout to prevent the tooltip from appearing if hiding
    clearTimeout(showTimeout);

    // Hide the tooltip immediately
    tooltip.style.display = 'none';
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
    'default': '<i class="fas fa-file"></i>' // Default icon for unknown file types
};

function updateFileIcons() {
    document.querySelectorAll('.file-item').forEach(item => {
        const fileExtension = item.dataset.extension || 'default';
        console.log(fileExtension);
        const icon = fileIcons[fileExtension] || fileIcons['default'];
        // item.setAttribute('data-icon', icon);
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
                // The file is encrypted, proceed with decryption
                // const file = keysFileInput.files[0];
                const privateKeyBase64 = localStorage.getItem(`privatekey_${postData.email}`);
                const publicKeyBase64 = localStorage.getItem(`publickey_${postData.email}`);
                var publicKey = await importPublicKey(publicKeyBase64);
                if (postData.public_key != "") {
                    publicKey = await importPublicKey(postData.public_key);
                }
                // Decrypt symmetric key
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
                // The file is not encrypted, directly handle the file data
                const fileData = hexToArrayBuffer(postData.encrypted_file_data); // Ensure the backend provides this for public files
                const fileExtension = postData.data_type;
                const publicKeyBase64 = localStorage.getItem(`publickey_${postData.email}`);
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
        ['decrypt']
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

async function decryptFileContents(key, encryptedFileDataHex) {
    try {
        const encryptedFileData = hexToArrayBuffer(encryptedFileDataHex);

        // Extract the IV from the beginning of the encrypted data
        const iv = encryptedFileData.slice(0, 12);
        const encryptedContent = encryptedFileData.slice(12);

        // Decrypt using AES-GCM
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
    // Reload the view_post.html page after a short delay
    /*setTimeout(() => {
        window.location.href = '/view_post';
    }, 500);  // Adjust the delay as needed */
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
        // Add more MIME types if needed
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
    // Split the path into parts and update the currentPath array
    const parts = path.split('/');
    currentPath = parts;
    updateFolderDisplay();
}

document.addEventListener('DOMContentLoaded', function () {
    const folderContainer = document.querySelector('.folder-container');
    let currentPath = []; // To keep track of the folder path

    // Function to build the folder structure
    function buildFolderStructure(metadata) {
        const folders = {};

        // Extract unique folders and subfolders
        metadata.forEach(item => {
            const path = item.internal_url;
            const parts = path.split('/');

            let current = folders;
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = index === parts.length - 1 ? { item: item } : {};
                }
                current = current[part];
            });
        });

        function generateFolderHTML(folder) {
            let html = '';
            // First, display all files
            for (const key in folder) {
                if (folder[key].item) {
                    const filePath = folder[key].item.internal_url;
                    const fileName = filePath.split('/').pop();
                    const fileExtension = fileName.split('.').pop().toLowerCase();
                    //const fileIcon = fileIcons[fileExtension] || fileIcons['default'];
                    html += `
                        <li class="metadata-item">
                            <div class="file-item"
                                 data-fullname="${fileName}"
                                 data-description="${folder[key].item.description}"
                                 data-extension="${fileExtension}"
                                 data-tags="${folder[key].item.tags}"
                                 onmouseover="showTooltip(event, '${folder[key].item.description}', '${folder[key].item.tags}', '${folder[key].item.file_size}', '${folder[key].item.last_modified}')"
                                 onmouseout="hideTooltip()"
                                 onclick="viewPost(${folder[key].item.id})">
                                <b>${fileName}</b>
                            </div>
                            <form action="/delete_post/${folder[key].item.id}" method="post" class="delete-form">
                                <button type="submit" onclick="return confirm('Are you sure you want to delete this post?');"><i class="fas fa-trash"></i></button>
                            </form>
                        </li>`;
                }
            }

            // Then, display all subfolders
            for (const key in folder) {
                if (!folder[key].item) {
                    html += `<div class="folder-item">
                        <span class="folder-name" onclick="navigateToFolder('${key}')">${key}</span>
                    </div>`;
                }
            }

            return html;
        }

        // Function to update the displayed folder content based on the current path
        function updateFolderDisplay() {
            let folder = folders;
            currentPath.forEach(part => {
                folder = folder[part];
            });

            const pathHtml = currentPath.map((part, index) => {
                const pathSoFar = currentPath.slice(0, index + 1).join('/');
                return `<span class="breadcrumb" onclick="navigateToPath('${pathSoFar}')"> ${part} </span>`;
            }).join(` / `);

            folderContainer.innerHTML = `
                <div class="navigation">
                    ${currentPath.length > 0 ? ` <i class="fas fa-chevron-left arrow-icon" onclick="goBack()"></i> ` : ` <i class="fas fa-chevron-left arrow-icon" onclick="goBack()"></i> `}
                    <span class="current-path">${ pathHtml || ''}</span>
                </div>
                ${generateFolderHTML(folder)}
            `;
            updateFileIcons();
        }

        // Function to navigate to a folder
        window.navigateToFolder = function (folderName) {
            currentPath.push(folderName);
            updateFolderDisplay();
        }

        // Function to go back one folder
        window.goBack = function () {
            currentPath.pop();
            updateFolderDisplay();
        }

        // Function to navigate to a specific path
        window.navigateToPath = function (path) {
            const parts = path.split('/');
            currentPath = parts;
            updateFolderDisplay();
        }

        // Initially display the root folder
        updateFolderDisplay();
    }

    // Check if there are posts
    if (metadataList.length === 0) {
        folderContainer.innerHTML = "<div ><p align='center' style='color: #666;'>No posts available.</p></div>";
    } else {
        buildFolderStructure(metadataList);
    }
});
