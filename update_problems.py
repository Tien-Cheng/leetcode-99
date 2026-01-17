
import json
import os

file_path = '/Users/hur/Downloads/leetcode-99/packages/realtime/src/problems.json'

with open(file_path, 'r') as f:
    problems = json.load(f)

for p in problems:
    if 'problemType' not in p:
        p['problemType'] = 'code'

with open(file_path, 'w') as f:
    json.dump(problems, f, indent=4)

print(f"Updated {len(problems)} problems.")
