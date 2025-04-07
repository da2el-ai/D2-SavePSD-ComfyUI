import subprocess
import sys

def install_package(package_name, options=""):
    command = [sys.executable, "-m", "pip", "install", package_name] + options.split()
    subprocess.check_call(command)

def main():
    try:
        print("Installing required packages...")
        # psd-toolsをインストール（--no-depsオプションを維持）
        install_package("psd-tools", "--no-deps")
        print("psd-tools installed successfully.")
        
        # scikit-imageを明示的にインストール
        print("Installing scikit-image...")
        install_package("scikit-image")
        print("scikit-image installed successfully.")
    
    except subprocess.CalledProcessError as e:
        print(f"An error occurred while installing packages: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
