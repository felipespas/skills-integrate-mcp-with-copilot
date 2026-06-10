document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const teacherNote = document.getElementById("teacher-note");
  const userMenuToggle = document.getElementById("user-menu-toggle");
  const userDropdown = document.getElementById("user-dropdown");
  const authStatusText = document.getElementById("auth-status-text");
  const loginTrigger = document.getElementById("login-trigger");
  const logoutTrigger = document.getElementById("logout-trigger");
  const loginModal = document.getElementById("login-modal");
  const closeLoginModal = document.getElementById("close-login-modal");
  const loginForm = document.getElementById("login-form");

  let adminToken = "";
  let teacherUsername = "";

  function authHeaders() {
    return adminToken ? { Authorization: `Bearer ${adminToken}` } : {};
  }

  function setMessage(text, type) {
    messageDiv.textContent = text;
    messageDiv.className = `message ${type}`;
    messageDiv.classList.remove("hidden");
    setTimeout(() => {
      messageDiv.classList.add("hidden");
    }, 5000);
  }

  function closeModal() {
    loginModal.classList.add("hidden");
    loginForm.reset();
  }

  function updateAuthUI() {
    const isTeacher = Boolean(adminToken);

    signupForm.classList.toggle("hidden", !isTeacher);
    teacherNote.textContent = isTeacher
      ? `Logged in as ${teacherUsername}. You can register and unregister students.`
      : "Only logged-in teachers can register or unregister students.";
    teacherNote.className = isTeacher ? "info-banner" : "warning-banner";

    authStatusText.textContent = isTeacher
      ? `Teacher: ${teacherUsername}`
      : "Student view";
    loginTrigger.classList.toggle("hidden", isTeacher);
    logoutTrigger.classList.toggle("hidden", !isTeacher);
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML with delete icons instead of bullet points
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${
                        adminToken
                          ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                          : ""
                      }</li>`
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons
      if (adminToken) {
        document.querySelectorAll(".delete-btn").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to unregister. Please try again.", "error");
      console.error("Error unregistering:", error);
    }
  }

  userMenuToggle.addEventListener("click", () => {
    const willShow = userDropdown.classList.contains("hidden");
    userDropdown.classList.toggle("hidden");
    userMenuToggle.setAttribute("aria-expanded", String(willShow));
  });

  loginTrigger.addEventListener("click", () => {
    userDropdown.classList.add("hidden");
    loginModal.classList.remove("hidden");
  });

  closeLoginModal.addEventListener("click", closeModal);

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();

      if (response.ok) {
        adminToken = result.token;
        teacherUsername = result.username;
        closeModal();
        updateAuthUI();
        fetchActivities();
        setMessage(result.message, "success");
      } else {
        setMessage(result.detail || "Login failed", "error");
      }
    } catch (error) {
      setMessage("Failed to login. Please try again.", "error");
      console.error("Error logging in:", error);
    }
  });

  logoutTrigger.addEventListener("click", async () => {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: authHeaders(),
      });
    } catch (error) {
      console.error("Error during logout:", error);
    }

    adminToken = "";
    teacherUsername = "";
    userDropdown.classList.add("hidden");
    updateAuthUI();
    fetchActivities();
    setMessage("Logged out", "info");
  });

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
          headers: authHeaders(),
        }
      );

      const result = await response.json();

      if (response.ok) {
        setMessage(result.message, "success");
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        setMessage(result.detail || "An error occurred", "error");
      }
    } catch (error) {
      setMessage("Failed to sign up. Please try again.", "error");
      console.error("Error signing up:", error);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".user-menu")) {
      userDropdown.classList.add("hidden");
      userMenuToggle.setAttribute("aria-expanded", "false");
    }
  });

  // Initialize app
  updateAuthUI();
  fetchActivities();
});
