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
                </div>
            `;

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
                </div>
            `;
        folderContainer.innerHTML = "<div><p align='center' style='color: #666;'>No posts available.</p></div>";
    } else {
        buildFolderStructure(metadataList);
    }
});
