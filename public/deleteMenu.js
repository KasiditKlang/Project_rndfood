function getAuthToken() {
    return localStorage.getItem('authToken');
}
        async function loadMeals() {
            try {
                const response = await fetch('/api/meals', {
            headers: { 'Authorization': `Bearer ${getAuthToken()}` }
        });
                if (!response.ok) throw new Error('Failed to load meals from MongoDB');
                const meals = await response.json();

                const menuList = document.getElementById('delete-menu-list');
                menuList.innerHTML = '';

                meals.forEach(meal => {
                    const listItem = document.createElement('li');
                    listItem.className = 'meal-item'; // ใช้เพื่อจัดรูปแบบของแต่ละรายการ
                    listItem.innerHTML = `
                        <div class="meal-container">
                            <img src="${meal.image}" alt="${meal.name}" class="meal-image-history">
                            <span class="meal-name">${meal.name}</span>
                            <button onclick="deleteMeal('${meal._id}')">Delete</button>
                        </div>
                    `;
                    menuList.appendChild(listItem);
                });
                               
            } catch (error) {
                console.error('Error loading meals:', error);
            }
        }

        async function deleteMeal(mealId) {
    if (confirm('Are you sure you want to delete this meal?')) {
        try {
            const response = await fetch(`/api/meals/${mealId}`, {
    headers: {
        'Authorization': `Bearer ${getAuthToken()}`
    },
    method: 'DELETE'
});


            if (response.ok) {
                alert('Meal deleted successfully!');
                loadMeals(); // Refresh the list after deletion
            } else {
                const errorMessage = await response.text();
                alert(`Failed to delete meal: ${errorMessage}`);
            }
        } catch (error) {
            console.error('Error deleting meal:', error);
            alert('Error deleting meal. Please try again.');
        }
    }
}
// Toggle the add menu form
function toggleAddMenuForm() {
    const form = document.getElementById("add-menu-form");
    form.style.display = form.style.display === "flex" ? "none" : "flex";

    // Ensure the form is reset whenever toggled open
    if (form.style.display === "flex") {
        document.getElementById("meal-name-input").value = "";
        document.getElementById("meal-image-input").value = "";
    }
}

// Hamburger
function toggleMenu() {
    const menu = document.getElementById('mobile-menu');
    const hamburger = document.querySelector('.hamburger');

    menu.classList.toggle('active'); // เพิ่ม/ลบคลาส active
    hamburger.classList.toggle('active'); // เพิ่มแอนิเมชันให้กับ hamburger icon
}

function fetchUsername() {
    const token = localStorage.getItem('authToken'); // ดึง Token จาก LocalStorage
    console.log('Token:', token); // ตรวจสอบว่า Token ถูกต้อง

    if (!token) {
        console.error('No token found. Please login again.');
        window.location.href = 'login.html';
        return;
    }

    fetch('http://localhost:3000/api/username', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`  // ส่ง Token ผ่าน Header
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error('Failed to fetch username');
        }
        return response.json();
    })
    .then(data => {
        console.log('Fetched user:', data); // ตรวจสอบข้อมูลที่ได้จาก API
        const usernameElement = document.querySelector('.logo p');
        usernameElement.textContent = data.username || 'ไม่พบชื่อผู้ใช้';
    })
    .catch(error => {
        console.error('Error fetching username:', error);
    });
}


        function goBack() {
            window.location.href = 'rndFood.html';
        }

        window.onload = loadMeals;
        
        fetchUsername().catch(() => {
            alert('Session expired. Please log in again.');
            localStorage.removeItem('authToken');
        });
        