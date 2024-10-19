document.addEventListener('DOMContentLoaded', function () {
    const flashMessages = document.querySelectorAll('.flash-messages .alert');

    flashMessages.forEach(function (message) {
        setTimeout(function () {
            message.classList.add('fade-out');
            setTimeout(function () {
                message.remove();
            }, 500);
        }, 3000);
    });
});
