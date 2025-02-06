import requests
import json
import os
from datetime import datetime

def get_remote_content():
    url = "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
    response = requests.get(url)
    response.raise_for_status()
    return response.json()

def main():
    try:
        # Get remote content
        remote_content = get_remote_content()
        
        # Check if local file exists
        local_path = "model_prices_and_context_window.json"
        if os.path.exists(local_path):
            with open(local_path, 'r') as f:
                local_content = json.load(f)
                
            if local_content == remote_content:
                print("No updates needed")
                return
        
        # Save new content
        with open(local_path, 'w') as f:
            json.dump(remote_content, f, indent=2)
        
        # Configure git
        os.system('git config --global user.name "GitHub Action"')
        os.system('git config --global user.email "action@github.com"')
        
        # Commit and push changes
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        os.system('git add model_prices_and_context_window.json')
        os.system(f'git commit -m "Update prices: {timestamp}"')
        os.system('git push')
        
        print("Successfully updated prices")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        exit(1)

if __name__ == "__main__":
    main() 