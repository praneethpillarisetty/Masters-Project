document.addEventListener('DOMContentLoaded', function () {
    const folderContainer = document.querySelector('#file-table-body');
    
    function buildFileList(metadata) {
        let html = '';

        metadata.forEach(item => {
            const filePath = item.internal_url;
            const fileName = filePath.split('/').pop();
            const fileExtension = fileName.split('.').pop().toLowerCase();
            html += `
            <tr><td><div class="file-item"
                     data-id="${item.id}"
                     data-fullname="${fileName}"
                     data-description="${item.description}"
                     data-extension="${fileExtension}"
                     data-tags="${item.tags}"
                     data-internal-url="${item.internal_url}"
                     data-file-size="${item.file_size}"
                     data-last-modified="${item.last_modified}"
                     onmouseover="showTooltip(event, '${item.description}', '${item.tags}', '${item.file_size}', '${item.last_modified}', '${filePath}')"
                     onmouseout="hideTooltip()"
                     onclick="viewPost(${item.id})">
                <b>${fileName}</b></td>
                <td>${item.last_modified}</td>
                <td>${fileExtension.toUpperCase()}</td>
                <td>${item.file_size}</td>
            </div>
            <td><div class="dropdown">
                <button class="dropdown-button" onclick="showDropdown(event, 'post', ${item.id})"><i class="fas fa-ellipsis-h"></i></button>
            </div></td>
        </tr>`;
        });

        folderContainer.innerHTML = html;
        updateFileIcons();
    }

    async function handleInputChange() {
        const searchInput = document.getElementById('search-input').value.trim();

        if (searchInput.length > 3) {
            try {
                const response = await fetch(`/search_files?query=${encodeURIComponent(searchInput)}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data.length > 0) {
                        buildFileList(data);
                    } else {
                        buildFileList(metadataList);
                    }
                } else {
                    console.error('Error fetching search results:', response.statusText);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        } else {
            buildFileList(metadataList);
        }
    }

    document.getElementById('search-input').addEventListener('input', handleInputChange);

    if (metadataList.length > 0) {
        buildFileList(metadataList);
    } else {
        folderContainer.innerHTML = "<div><p align='center' style='color: #666;'>No posts available.</p></div>";
    }
});


