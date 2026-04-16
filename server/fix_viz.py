import re

path = 'services/visualization_service.py'
content = open(path, encoding='utf-8').read()

# Remove the geographical_map elif block (from its elif to the next top-level elif or comment)
# Strategy: find the block start and end using line-by-line approach
lines = content.splitlines(keepends=True)

start_idx = None
end_idx = None

for i, line in enumerate(lines):
    if start_idx is None and 'elif chart_type == "geographical_map"' in line:
        start_idx = i
    elif start_idx is not None and i > start_idx:
        # Look for next elif/else at the same indentation level (8 spaces)
        stripped = line.rstrip()
        if stripped and not stripped.startswith('        #') and (
            stripped.startswith('        elif ') or stripped.startswith('        else:')
        ) and 'geographical_map' not in stripped:
            end_idx = i
            break

if start_idx is not None and end_idx is not None:
    new_lines = lines[:start_idx] + lines[end_idx:]
    open(path, 'w', encoding='utf-8').write(''.join(new_lines))
    print(f"Removed geographical_map block (lines {start_idx+1} to {end_idx})")
else:
    print(f"start_idx={start_idx}, end_idx={end_idx} - block not found or boundary unclear")
