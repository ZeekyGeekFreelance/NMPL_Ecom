const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const serverRoot = path.resolve(__dirname, "..");
const userServiceSource = fs.readFileSync(
  path.join(serverRoot, "src", "modules", "user", "user.service.ts"),
  "utf8"
);
const userDtoSource = fs.readFileSync(
  path.join(serverRoot, "src", "modules", "user", "user.dto.ts"),
  "utf8"
);

module.exports = [
  {
    name: "admin onboarding and resets force first-login password rotation",
    run() {
      assert.match(userServiceSource, /createAdmin[\s\S]*mustChangePassword: true/);
      assert.match(
        userServiceSource,
        /updateAdminPassword[\s\S]*updateUserPassword[\s\S]*mustChangePassword: true/
      );
    },
  },
  {
    name: "admin creation DTO enforces strong passwords",
    run() {
      assert.match(userDtoSource, /Password must contain at least one uppercase letter/);
      assert.match(userDtoSource, /Password must contain at least one lowercase letter/);
      assert.match(userDtoSource, /Password must contain at least one number/);
      assert.match(
        userDtoSource,
        /Password must contain at least one special character \(!@#\$%\^&\*\)/
      );
    },
  },
];
