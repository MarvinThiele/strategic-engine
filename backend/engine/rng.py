import numpy as np

class DRNG:
    """Deterministic Random Number Generator wrapper."""

    def __init__(self, seed: int):
        self.g = np.random.Generator(np.random.PCG64(seed))

    def bernoulli(self, p: float) -> bool:
        """Return True with probability p."""
        return bool(self.g.random() < p)

    def uniform(self, a: float, b: float) -> float:
        """Return a random float in [a, b)."""
        return float(self.g.uniform(a, b))
