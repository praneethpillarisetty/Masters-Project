document.getElementById('uploadType').addEventListener('change', function () {
    const fileInput = document.getElementById('fileInput');
    const folderPathInput = document.getElementById('folderPath');

    if (this.value === 'folder') {
        
        fileInput.setAttribute('webkitdirectory', '');
        fileInput.setAttribute('directory', ''); 
        fileInput.setAttribute('multiple', '');  

        fileInput.addEventListener('change', function () {
            if (fileInput.files.length > 0) {
                
                const firstFile = fileInput.files[0];
                const relativePath = firstFile.webkitRelativePath || firstFile.name;
                const pathParts = relativePath.split('/');
                if (pathParts.length > 1) {
                    const folderName = pathParts[0];
                    folderPathInput.value = `/${folderName}/`;
                }
            }
        });
    } else {
        fileInput.removeAttribute('webkitdirectory');
        fileInput.removeAttribute('directory'); 
        fileInput.setAttribute('multiple', ''); 

        
        folderPathInput.value = '/';
    }
});

document.getElementById('uploadForm').addEventListener('submit', async (event) => {
    event.preventDefault();

    const fileInput = document.getElementById('fileInput');
    const isPublic = false;
    const files = fileInput.files;
    const folderPath = document.getElementById('folderPath').value;
    if (files.length === 0) {
        alert('Please select files to encrypt.');
        return;
    }

    const fileDetails = {
        data_types: [],
        digital_signatures: [],
        encrypted_keys: []
    };
    const dataTransfer = new DataTransfer();
    for (const file of files) {
        const fileContents = await readFile(file);
        const data_type = file.name.split('.').pop();
        const privateKeyBase64 = localStorage.getItem(`privatekey_${currentUserEmail}`);
        const digital_signature = await signData(fileContents, privateKeyBase64);

        let encrypted_key = "";
        let isExistingFile = false;
        const response = await fetch(`/check_file_exists?filename=${encodeURIComponent(file.name)}&folderPath=${encodeURIComponent(folderPath)}`);
        const result = await response.json();
        if (result.exists) {
            encrypted_key = result.encrypted_key;
            isExistingFile = true;
        }
        var symmetricKey = "";
        if (!isPublic) {
            if (isExistingFile) {
                const privateKey = await importPrivateKey(privateKeyBase64);
                const decryptedSymmetricKey = await decryptSymmetricKey(privateKey, encrypted_key);
                symmetricKey = await importSymmetricKey(decryptedSymmetricKey);
            }
            else {
                symmetricKey = await generateSymmetricKey();
            }
            const encryptedFileContents = await encryptFileContents(symmetricKey, fileContents);
            const publicKey = localStorage.getItem(`publickey_${currentUserEmail}`);
            encrypted_key = await encryptSymmetricKey(publicKey, symmetricKey);

            
            const encryptedBlob = new Blob([encryptedFileContents], { type: 'application/octet-stream' });
            const encryptedFile = new File([encryptedBlob], file.name, { type: 'application/octet-stream' });
            dataTransfer.items.add(encryptedFile);

        }
        fileDetails.data_types.push(data_type);
        fileDetails.digital_signatures.push(digital_signature);
        fileDetails.encrypted_keys.push(arrayBufferToBase64(encrypted_key));
    }
    fileInput.files = dataTransfer.files;
    
    document.getElementById('data_types').value = JSON.stringify(fileDetails.data_types);
    document.getElementById('digital_signatures').value = JSON.stringify(fileDetails.digital_signatures);
    document.getElementById('encrypted_keys').value = JSON.stringify(fileDetails.encrypted_keys);

    
    document.getElementById('uploadForm').submit();
});

document.getElementById('folderPath').addEventListener('input', async function () {
    const input = this.value;

    
    const datalist = document.getElementById('folderList');
    const errorMsg = document.getElementById('folderError');

    
    if (input.length < 1 || !input.startsWith('/')) {
        datalist.innerHTML = ''; 
        errorMsg.textContent = 'Folder path must start with "/"'; 
        return;
    }

    
    errorMsg.textContent = '';

    
    const response = await fetch(`/get_folders?query=${encodeURIComponent(input)}`);
    const folders = await response.json();

    
    datalist.innerHTML = '';
    folders.forEach(folder => {
        const option = document.createElement('option');
        option.value = folder;
        datalist.appendChild(option);
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const folderContainer = document.querySelector('#file-table-body');
    const breadcrumbContainer = document.querySelector('#breadcrumb-container');

    
    function buildFolderStructure(metadata) {
        const folders = {};

        
        metadata.forEach(item => {
            const path = item.internal_url;
            const parts = path.split('/');

            let current = folders;
            parts.forEach((part, index) => {
                if (!current[part]) {
                    current[part] = index === parts.length - 1 ? { item } : {};
                }
                current = current[part];
            });
        });

        
        function generateFolderHTML(folder) {
            let html = '';
            const folderDetails = calculateFolderDetails(folder);

            
            for (const key in folder) {
                if (folder[key].item) {
                    const file = folder[key].item;
                    const fileName = file.internal_url.split('/').pop();
                    const fileExtension = fileName.split('.').pop().toLowerCase();
                    html += `
                <tr>
                    <td>
                        <div class="file-item" data-fullname="${fileName}" data-description="${file.description}" data-extension="${fileExtension}" data-tags="${file.tags}"
                            onmouseover="showTooltip(event, '${file.description}', '${file.tags}', '${file.file_size}', '${file.last_modified}', '${file.internal_url}')"
                            onmouseout="hideTooltip()"
                            onclick="viewPost(${file.id})">
                            <b>${fileName}</b>
                        </div>
                    </td>
                    <td>${file.last_modified}</td>
                    <td>${fileExtension.toUpperCase()}</td>
                    <td>${file.file_size}</td>
                    <td>
                        <div class="dropdown">
                            <button class="dropdown-button" onclick="showDropdown(event, 'post', ${file.id})">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
                }
            }

            
            for (const key in folder) {
                if (!folder[key].item) {
                    const folderInfo = folderDetails[key] || { lastModified: '', size: 0 };
                    html += `
                <tr>
                    <td>
                        <div class="folder-item">
                            <span class="folder-name" onclick="navigateToFolder('${key}')">${key}</span>
                        </div>
                    </td>
                    <td>${formatDate(folderInfo.lastModified)}</td>
                    <td>Folder</td>
                    <td>${formatSize(folderInfo.size)}</td>
                    <td>
                        <div class="dropdown">
                            <button class="dropdown-button" onclick="showDropdown(event, 'folder', '${key}')">
                                <i class="fas fa-ellipsis-h"></i>
                            </button>
                        </div>
                    </td>
                </tr>`;
                }
            }

            return html;
        }

        
        function calculateFolderDetails(folder) {
            let details = {};

            function parseSize(sizeStr) {
                
                const match = sizeStr.match(/(\d+)([KMG]?)$/);
                if (!match) return 0;

                let size = parseInt(match[1], 10);
                switch (match[2]) {
                    case 'K':
                        size *= 1024;
                        break;
                    case 'M':
                        size *= 1024 * 1024;
                        break;
                    case 'G':
                        size *= 1024 * 1024 * 1024;
                        break;
                }
                return size;
            }

            function traverseFolder(folder, currentPath = '') {
                let folderSize = 0; 
                let folderModifiedDate = new Date(0); 

                for (const key in folder) {
                    if (folder[key].item) {
                        
                        const fileSizeStr = folder[key].item.file_size;
                        const fileSize = parseSize(fileSizeStr); 
                        const fileModified = new Date(folder[key].item.last_modified);

                        
                        folderSize += fileSize; 
                        folderModifiedDate = new Date(Math.max(folderModifiedDate, fileModified)); 
                    } else {
                        
                        const newPath = currentPath ? `${currentPath}/${key}` : key;
                        const subfolderDetails = traverseFolder(folder[key], newPath);

                        
                        folderSize += subfolderDetails.size;
                        
                        folderModifiedDate = new Date(Math.max(folderModifiedDate, subfolderDetails.lastModified));
                    }
                }

                
                details[currentPath] = {
                    size: folderSize,
                    lastModified: folderModifiedDate
                };

                return details[currentPath]; 
            }

            
            traverseFolder(folder);

            return details;
        }

        
        function updateFolderDisplay() {
            let folder = folders;
            currentPath.forEach(part => {
                folder = folder[part];
            });

            const pathHtml = currentPath.map((part, index) => {
                const pathSoFar = currentPath.slice(0, index + 1).join('/');
                return `<span class="breadcrumb" onclick="navigateToPath('${pathSoFar}')">${part}</span>`;
            }).join(' / ');

            breadcrumbContainer.innerHTML = `
                <div class="navigation">
                    ${currentPath.length > 0 ? `<i class="fas fa-chevron-left arrow-icon" onclick="goBack()"></i>` : ''}
                    <span class="current-path">${pathHtml}</span>
                    <button id="upload-button" class="upload-button"><i class="fa-solid fa-upload"></i></button>
                </div>
            `;
            upload_show();
            folderContainer.innerHTML = generateFolderHTML(folder);
            updateFileIcons();
        }

        
        window.navigateToFolder = function (folderName) {
            currentPath.push(folderName);
            updateFolderDisplay();
        };

        window.goBack = function () {
            currentPath.pop();
            updateFolderDisplay();
        };

        window.navigateToPath = function (path) {
            currentPath = path.split('/');
            updateFolderDisplay();
        };

        
        updateFolderDisplay();

    }

    
    if (metadataList.length === 0) {
        breadcrumbContainer.innerHTML = `
                <div class="navigation">
                    ${currentPath.length > 0 ? `<i class="fas fa-chevron-left arrow-icon" onclick="goBack()"></i>` : ''}
                    <button id="upload-button" class="upload-button"><i class="fa-solid fa-upload"></i></button>
                </div>
            `;
        folderContainer.innerHTML = "<div><p align='center' style='color: #666;'>No posts available.</p></div>";
        upload_show();
    } else {
        buildFolderStructure(metadataList);
        upload_show();
    }
    
});
