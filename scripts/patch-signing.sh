#!/bin/bash
# Inject signing config into Expo-generated android/app/build.gradle

GRADLE_FILE="android/app/build.gradle"

# Add signingConfigs block before buildTypes
python3 -c "
import re
with open('$GRADLE_FILE', 'r') as f:
    content = f.read()

signing_block = '''
    signingConfigs {
        release {
            if (project.hasProperty('MYAPP_RELEASE_STORE_FILE')) {
                storeFile file(MYAPP_RELEASE_STORE_FILE)
                storePassword MYAPP_RELEASE_STORE_PASSWORD
                keyAlias MYAPP_RELEASE_KEY_ALIAS
                keyPassword MYAPP_RELEASE_KEY_PASSWORD
            }
        }
    }
'''

# Insert before buildTypes
content = content.replace('    buildTypes {', signing_block + '\n    buildTypes {')

# Add signingConfig to release build type
content = content.replace(
    '        release {',
    '''        release {
            signingConfig signingConfigs.release'''
)

with open('$GRADLE_FILE', 'w') as f:
    f.write(content)
print('Signing config patched successfully')
"
