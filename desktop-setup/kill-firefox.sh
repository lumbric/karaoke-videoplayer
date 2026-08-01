#!/bin/bash
#
# Will kill firefox if password is correct.

SALT="my_karaokeSalt"
HASHED_PASSWORD="906c7818eac979008e519d6592870ca0c095e501"

# Prompt for password using Zenity
PASSWORD=$(zenity --password --title="Authentication Required")

# If cancel was pressed, exit
if [ $? -ne 0 ]; then
    echo "User cancelled."
    exit 1
fi

# Compute salted SHA1 hash
COMPUTED_HASH=$(echo -n "${SALT}${PASSWORD}" | sha1sum | awk '{print $1}')

# Validate
if [[ "$COMPUTED_HASH" == "$HASHED_PASSWORD" ]]; then
    killall "firefox"
else
    zenity --error --title="Access Denied" --text="Incorrect password."
    exit 1
fi
