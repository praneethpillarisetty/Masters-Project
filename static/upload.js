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
            if (isExistingFile)
            {
                const privateKey = await importPrivateKey(privateKeyBase64);
                const decryptedSymmetricKey = await decryptSymmetricKey(privateKey, encrypted_key);
                symmetricKey = await importSymmetricKey(decryptedSymmetricKey);
            }
            else
            {
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