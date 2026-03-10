#!/usr/bin/env python3
"""Setup script for Microsoft Agent Framework Contract Agents

This script helps set up the Microsoft Agent Framework environment
for contract processing agents.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class MicrosoftAgentFrameworkSetup:
    """Setup helper for Microsoft Agent Framework"""
    
    def __init__(self):
        self.project_root = Path(__file__).parent
        self.venv_path = self.project_root / "venv"
        self.requirements_file = self.project_root / "requirements.txt"
        self.env_template = self.project_root / ".env.template"
        self.env_file = self.project_root / ".env"
    
    def check_python_version(self):
        """Check Python version compatibility"""
        logger.info("Checking Python version...")
        
        version_info = sys.version_info
        if version_info < (3, 9):
            logger.error("Python 3.9+ required, found %s.%s", version_info.major, version_info.minor)
            return False
        
        logger.info("Python %s.%s.%s [PASS]", version_info.major, version_info.minor, version_info.micro)
        return True
    
    def create_virtual_environment(self):
        """Create Python virtual environment"""
        logger.info("Creating virtual environment...")
        
        if self.venv_path.exists():
            logger.info("Virtual environment already exists")
            return True
        
        try:
            subprocess.run([sys.executable, "-m", "venv", str(self.venv_path)], 
                         check=True, capture_output=True, text=True)
            logger.info("Virtual environment created at %s", self.venv_path)
            return True
        except subprocess.CalledProcessError as e:
            logger.error("Failed to create virtual environment: %s", e)
            return False
    
    def get_pip_executable(self):
        """Get pip executable path for the virtual environment"""
        if os.name == 'nt':  # Windows
            return self.venv_path / "Scripts" / "pip.exe"
        else:  # Unix/Linux/macOS
            return self.venv_path / "bin" / "pip"
    
    def install_dependencies(self):
        """Install Python dependencies"""
        logger.info("Installing dependencies...")
        
        if not self.requirements_file.exists():
            logger.error("Requirements file not found: %s", self.requirements_file)
            return False
        
        pip_exe = self.get_pip_executable()
        
        try:
            # Upgrade pip first
            subprocess.run([str(pip_exe), "install", "--upgrade", "pip"], 
                         check=True, capture_output=True, text=True)
            
            # Install requirements with --pre flag for preview packages
            subprocess.run([str(pip_exe), "install", "-r", str(self.requirements_file), "--pre"], 
                         check=True, capture_output=True, text=True)
            
            logger.info("Dependencies installed successfully [PASS]")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error("Failed to install dependencies: %s", e)
            logger.error("stdout: %s", e.stdout)
            logger.error("stderr: %s", e.stderr)
            return False
    
    def setup_environment_file(self):
        """Set up environment configuration file"""
        logger.info("Setting up environment configuration...")
        
        if self.env_file.exists():
            logger.info("Environment file (.env) already exists")
            return True
        
        if not self.env_template.exists():
            logger.error("Environment template not found: %s", self.env_template)
            return False
        
        try:
            shutil.copy2(self.env_template, self.env_file)
            logger.info("Environment template copied to %s", self.env_file)
            logger.warning("IMPORTANT: Edit .env file with your actual configuration values.")
            return True
        except shutil.Error as e:
            logger.error("Failed to copy environment template: %s", e)
            return False
    
    def verify_installation(self):
        """Verify the installation by importing modules"""
        logger.info("Verifying installation...")
        
        python_exe = self.venv_path / ("Scripts/python.exe" if os.name == 'nt' else "bin/python")
        
        test_script = '''
import sys
try:
    # Test core dependencies
    import pydantic
    import yaml
    import opentelemetry
    print("Core dependencies: ✓")
    
    # Test Microsoft Agent Framework (may not be available in preview)
    try:
        from agent_framework.openai_client import OpenAIChatClient
        print("Microsoft Agent Framework: ✓")
    except ImportError as e:
        print(f"Microsoft Agent Framework: ⚠️  Preview package not available: {e}")
        print("This is expected if the preview packages are not yet released")
    
    print("Installation verification completed!")
    sys.exit(0)
    
except ImportError as e:
    print(f"Import error: {e}")
    sys.exit(1)
'''
        
        try:
            result = subprocess.run([str(python_exe), "-c", test_script], 
                                  capture_output=True, text=True, timeout=30, check=False)
            
            if result.returncode == 0:
                logger.info("Installation verification passed [PASS]")
                logger.info(result.stdout)
                return True
            else:
                logger.error("Installation verification failed")
                logger.error(result.stderr)
                return False
                
        except subprocess.TimeoutExpired:
            logger.error("Installation verification timed out")
            return False
    
    def print_next_steps(self):
        """Print next steps for the user"""
        print("\n" + "="*60)
        print("Microsoft Agent Framework Setup Complete!")
        print("="*60)
        print()
        print("Next Steps:")
        print("1. Activate virtual environment:")
        if os.name == 'nt':
            print(f"   {self.venv_path}\\Scripts\\activate")
        else:
            print(f"   source {self.venv_path}/bin/activate")
        print()
        print("2. Configure environment variables:")
        print(f"   Edit {self.env_file} with your Microsoft Foundry credentials")
        print()
        print("3. Start MCP servers (in separate terminal):")
        print("   cd ../../")
        print("   npm run start:mcp-servers")
        print()
        print("4. Run the demo:")
        print("   python demo.py")
        print()
        print("📚 Documentation: See README.md for detailed usage")
        print()
    
    def run_setup(self):
        """Run complete setup process"""
        logger.info("Starting Microsoft Agent Framework setup...")
        
        steps = [
            ("Python version check", self.check_python_version),
            ("Virtual environment", self.create_virtual_environment),
            ("Dependencies installation", self.install_dependencies),
            ("Environment configuration", self.setup_environment_file),
            ("Installation verification", self.verify_installation)
        ]
        
        for step_name, step_func in steps:
            logger.info("\n--- %s ---", step_name)
            if not step_func():
                logger.error("Setup failed at: %s", step_name)
                return False
        
        self.print_next_steps()
        return True


def main():
    """Main entry point"""
    try:
        setup = MicrosoftAgentFrameworkSetup()
        success = setup.run_setup()
        
        if success:
            logger.info("Setup completed successfully!")
            sys.exit(0)
        else:
            logger.error("Setup failed!")
            sys.exit(1)
            
    except KeyboardInterrupt:
        logger.info("Setup interrupted by user")
        sys.exit(1)


if __name__ == "__main__":
    main()