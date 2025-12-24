import zipfile
import os
import shutil

zip_path = 'assets/simcity2000.zip'
temp_dir = 'assets/temp_sc2000_clean'

# 1. Unzip
if os.path.exists(temp_dir):
    shutil.rmtree(temp_dir)
os.makedirs(temp_dir)

with zipfile.ZipFile(zip_path, 'r') as zip_ref:
    zip_ref.extractall(temp_dir)

# 2. Rename and Clean
# Check for "Sim City 2000" and rename to "SC2000"
sc_old_path = os.path.join(temp_dir, "Sim City 2000")
sc_new_path = os.path.join(temp_dir, "SC2000")

if os.path.exists(sc_new_path):
    shutil.rmtree(sc_new_path)

if os.path.exists(sc_old_path):
    print(f"Renaming {sc_old_path} to {sc_new_path}")
    os.rename(sc_old_path, sc_new_path)

# Remove __MACOSX if exists
macosx_path = os.path.join(temp_dir, "__MACOSX")
if os.path.exists(macosx_path):
    print(f"Removing {macosx_path}")
    shutil.rmtree(macosx_path)

# Also walk and remove any .DS_Store
for root, dirs, files in os.walk(temp_dir):
    for file in files:
        if file == '.DS_Store' or file.startswith('._'):
            os.remove(os.path.join(root, file))

# 3. Zip it back up (without extra attribs)
backup_path = zip_path + ".bak"
if os.path.exists(zip_path):
    os.rename(zip_path, backup_path)

print(f"Creating clean zip at {zip_path}")
with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(temp_dir):
        for file in files:
            file_path = os.path.join(root, file)
            # Create a relative path inside the zip
            arcname = os.path.relpath(file_path, start=temp_dir)
            zipf.write(file_path, arcname)

# Cleanup
shutil.rmtree(temp_dir)
print("Done!")
