import pathlib
import sys

# The package is under `src/`, and these tests run against the working tree
# rather than an install: a test suite that only passes after `pip install -e .`
# is a suite nobody runs before pushing.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1] / "src"))
