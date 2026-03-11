"""
python_modules/training_bridge.py

Provides BullWiserTrainingBridge: trains a RandomForest model from structured
training data, stores it via model_manager, and serves predictions.
"""

import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score

# Fix: was "from python_modules.model_manager import ..." (absolute import).
# Absolute imports only work when the script is run from the project root with
# python_modules/ on sys.path. Relative imports work regardless of where the
# package is imported from, making this module correctly reusable.
from .model_manager import save_bullwiser_model, load_bullwiser_model, BullWiserModelManager

DIRECTION_MAP = {0: 'bearish', 1: 'neutral', 2: 'bullish'}


class BullWiserTrainingBridge:
    """Bridge between BullWiser's training data format and scikit-learn models."""

    def __init__(self):
        self._manager = BullWiserModelManager()

    # ------------------------------------------------------------------
    def train_from_data(self, training_data):
        """
        Train a RandomForest from the standard BullWiser training_data dict.

        Parameters
        ----------
        training_data : dict with keys 'features', 'targets', 'metadata'

        Returns
        -------
        dict with keys: success, train_accuracy, test_accuracy, model_path,
                        feature_count, feature_importance, error
        """
        try:
            X = np.array(training_data['features'])
            y = np.array(training_data['targets'])
            meta = training_data.get('metadata', {})
            model_name = meta.get('model_name', 'bullwiser_model')

            X_train, X_test, y_train, y_test = train_test_split(
                X, y, test_size=0.2, random_state=42, stratify=y
            )

            model = RandomForestClassifier(n_estimators=100, random_state=42)
            model.fit(X_train, y_train)

            train_acc = accuracy_score(y_train, model.predict(X_train))
            test_acc  = accuracy_score(y_test,  model.predict(X_test))

            save_result = save_bullwiser_model(
                model, model_name,
                accuracy=test_acc,
                description=meta.get('training_period', ''),
                created_by='training_bridge',
            )

            return {
                'success':            True,
                'train_accuracy':     float(train_acc),
                'test_accuracy':      float(test_acc),
                'model_path':         save_result.get('model_path', ''),
                'feature_count':      X.shape[1],
                'feature_importance': model.feature_importances_.tolist(),
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ------------------------------------------------------------------
    def predict_with_model(self, model_name, features):
        """
        Load a saved model and return a prediction for the given feature vector.

        Returns
        -------
        dict with keys: success, prediction (dict), error
        """
        try:
            load_result = load_bullwiser_model(model_name)
            if not load_result['success']:
                return {'success': False, 'error': load_result.get('error', 'Load failed')}

            model = load_result['model']
            X = np.array(features).reshape(1, -1)
            raw = int(model.predict(X)[0])
            proba = model.predict_proba(X)[0].tolist()
            confidence = float(max(proba)) * 100.0

            return {
                'success': True,
                'prediction': {
                    'direction':       DIRECTION_MAP.get(raw, 'unknown'),
                    'raw_prediction':  raw,
                    'confidence':      confidence,
                    'probabilities':   proba,
                },
            }
        except Exception as e:
            return {'success': False, 'error': str(e)}

    # ------------------------------------------------------------------
    def list_available_models(self):
        """
        Return a list of all saved model metadata dicts.

        Returns
        -------
        dict with keys: success, models (list), error
        """
        try:
            models = self._manager.list_models()
            return {'success': True, 'models': models}
        except Exception as e:
            return {'success': False, 'models': [], 'error': str(e)}
