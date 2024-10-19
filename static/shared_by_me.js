async function viewSharePost(postId, filename) {
    try {
        
        const sharedUsersResponse = await fetch(`/get_shared_users/${postId}`);
        const sharedUsersData = await sharedUsersResponse.json();
        console.log(sharedUsersData);
        
        const container = document.getElementById('file-table-container');

        
        if (!container) {
            console.error("Container element not found.");
            return;
        }

        
        if (sharedUsersData.length === 0) {
            container.innerHTML = '<p>No shared users found.</p>';
            return;
        }

        
        const originalContent = container.innerHTML;

        
        container.innerHTML = `
            <div id="user-details">
                <h4 align='center'>Shared Users </h4>
                <p align='center'><strong>File Name:</strong> ${filename}</p>
                <div id="user-list">
                    ${sharedUsersData.map(user => `
                        <div class="user-block">
                            <p><strong>Name:</strong> ${user.first_name} ${user.last_name}</p>
                            <p><strong>Email:</strong> ${user.email}</p>
                            <p><strong>Expiration Date:</strong> ${user.expiration_date}</p>
                            <button class="extend-time" data-post-id="${postId}" data-user-id="${user.user_id}">Extend Time</button>
                            <button class="revoke-access" data-post-id="${postId}" data-user-id="${user.user_id}">Revoke Access</button>
                        </div>
                    `).join('')}
                </div>
                <button id="back-button">Back</button>
            </div>
        `;

        
        document.getElementById('back-button').addEventListener('click', function () {
            
            window.location.reload();
        });

        
        document.querySelectorAll('.extend-time').forEach(button => {
            button.addEventListener('click', async function () {
                const postId = this.getAttribute('data-post-id');
                const userId = this.getAttribute('data-user-id');
                await extendShareTime(postId, userId);
            });
        });

        document.querySelectorAll('.revoke-access').forEach(button => {
            button.addEventListener('click', async function () {
                const postId = this.getAttribute('data-post-id');
                const userId = this.getAttribute('data-user-id');
                await revokeShare(postId, userId);
                
                this.closest('.user-block').remove();
            });
        });

    } catch (error) {
        console.error("Error fetching shared users data:", error);
        alert('Error fetching shared users.');
    }
}


document.addEventListener('DOMContentLoaded', () => {
    updateFileIcons(); 
});

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
                     data-fullname="${fileName}"
                     data-description="${item.description}"
                     data-extension="${fileExtension}"
                     data-tags="${item.tags}"
                     onclick="viewSharePost(${item.id}, '${fileName}')">
                    <b>${fileName}</b></td>
                    <td>${item.last_modified}</td>
                    <td>${fileExtension.toUpperCase()}</td>
                    <td>${item.file_size}</td>
                </div>
                <td><div class="dropdown">
                    <button class="dropdown-button" onclick="showDropdown(event, ${item.id})"><i class="fas fa-ellipsis-h"></i></button>
                </div></td>
            </tr>`;
        });

        
        folderContainer.innerHTML = html;
    }

    if (metadataList.length === 0) {
        folderContainer.innerHTML = "<div><p align='center' style='color: #666;'>No posts available.</p></div>";
    } else {
        buildFileList(metadataList);
        updateFileIcons();
    }
});
