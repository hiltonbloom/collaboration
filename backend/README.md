# Active Directory Query Tool - Setup Guide

This guide will help you connect the React frontend to a backend service that can query Active Directory.

## Prerequisites

You'll need:

1. A machine with Windows and PowerShell
2. Active Directory modules installed on PowerShell
3. Appropriate permissions to query Active Directory
4. Node.js or Python installed, depending on which backend you choose

## Option 1: Node.js Backend

### Step 1: Install Node.js Backend Dependencies

```bash
mkdir ad-backend
cd ad-backend
npm init -y
npm install express cors child_process
```

### Step 2: Create the server.js file

Create a file named `server.js` in the `ad-backend` directory and copy the code from the provided Node.js backend artifact.

### Step 3: Start the Node.js Backend

```bash
node server.js
```

The server will start on port 3001 by default.

## Option 2: Python FastAPI Backend

### Step 1: Install Python Dependencies

```bash
pip install fastapi uvicorn pydantic
```

### Step 2: Create the main.py file

Create a file named `main.py` and copy the code from the provided Python FastAPI backend artifact.

### Step 3: Start the Python Backend

```bash
uvicorn main:app --reload --port 8000
```

The server will start on port 8000 by default.

## Step 4: Update the React Frontend

Replace the contents of `src/components/ActiveDirectoryQuery/ActiveDirectoryQuery.jsx` with the updated component code from the provided artifact.

Make sure to update the `API_URL` constant at the beginning of the file to match your backend's address:

```javascript
// For Node.js backend
const API_URL = 'http://localhost:3001/api';

// OR for Python FastAPI backend
const API_URL = 'http://localhost:8000/api';
```

## Step 5: Install Required PowerShell Modules

Ensure the Active Directory PowerShell module is installed. You can run this command in PowerShell with Administrator privileges:

```powershell
Install-WindowsFeature RSAT-AD-PowerShell
```

## Step 6: Start your React Application

```bash
npm start
```

## Troubleshooting

### Authentication Issues

If you encounter authentication issues when querying Active Directory:

1. Make sure you're running the backend on a Windows machine that's joined to the domain
2. Ensure your user account has permissions to query Active Directory
3. Try running PowerShell as Administrator

### PowerShell Execution Policy

If PowerShell won't execute scripts, you may need to adjust the execution policy:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### CORS Issues

If you encounter CORS issues, ensure the backend CORS settings include your React app's URL. In the Node.js backend, you can modify the CORS middleware:

```javascript
app.use(cors({
  origin: 'http://localhost:3000'  // Replace with your React app's URL
}));
```

### Customizing the Query

You can customize the PowerShell commands in the backend to suit your specific needs. For example, to filter by different attributes or to include additional information in the results.

## Security Considerations

This implementation has several security considerations:

1. **Input Validation**: Both backends include basic validation to prevent command injection, but you may want to enhance this for production use.

2. **Authentication**: This example doesn't include authentication. In a production environment, you should add authentication to ensure only authorized users can query AD.

3. **HTTPS**: For production use, configure HTTPS to encrypt data in transit.

4. **Error Handling**: Enhance error handling to avoid exposing sensitive information in error messages.

## Next Steps

Once your basic implementation is working, consider these enhancements:

1. Add pagination on the server side for large result sets
2. Implement caching to improve performance
3. Add more advanced filtering options
4. Add support for creating, updating, or deleting AD objects (with appropriate permissions)
5. Implement user authentication and role-based access control
