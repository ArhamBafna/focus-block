import os
import subprocess
import time
import sqlite3
import sys

def check_process_running(process_name):
    # Check if a process with process_name is currently running using tasklist
    try:
        output = subprocess.check_output(f'tasklist /FI "IMAGENAME eq {process_name}"', shell=True).decode()
        return process_name.lower() in output.lower()
    except Exception as e:
        print(f"Error checking process: {e}")
        return False

def main():
    print("Starting Desktop Flow Automation Test...")

    # We will simulate the test flow here.
    # In a fully fleshed out environment, this script could use pywinauto to click
    # the Tauri app UI. For now, this serves as the foundational skeleton to
    # interact with the SQLite database and verify process behavior.
    
    appdata = os.environ.get('ALLUSERSPROFILE', 'C:\\ProgramData')
    db_path = os.path.join(appdata, 'FocusBlock', 'data.db')
    
    print(f"Verifying database path: {db_path}")

    # Launching a test notepad instance
    print("Launching notepad.exe...")
    notepad_proc = subprocess.Popen(["notepad.exe"])
    time.sleep(1)

    if check_process_running("notepad.exe"):
        print("Success: notepad.exe is running.")
    else:
        print("Failure: notepad.exe did not start.")
        sys.exit(1)

    print("Closing notepad.exe...")
    notepad_proc.kill()
    notepad_proc.wait()

    print("Verifying database schema...")
    try:
        if os.path.exists(db_path):
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
            tables = cursor.fetchall()
            print(f"Found tables: {[t[0] for t in tables]}")
            conn.close()
        else:
            print("Database not found yet. The service will create it.")
    except Exception as e:
        print(f"Database verification failed: {e}")

    print("Automation test complete.")

if __name__ == "__main__":
    main()
