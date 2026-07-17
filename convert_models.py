# convert_models.py
import joblib
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType

MODELS = {
    "decision_tree": "decision_tree_model.pkl",
    "random_forest": "random_forest_model.pkl",
    "svm": "svm_model.pkl",
}

# Exact feature order and count your models were trained on:
# age, gender, height, weight, ap_hi, ap_lo,
# cholesterol, gluc, smoke, alco, active,
# BMI, pulse_pressure, bp_category
INPUT_FEATURES = 14

for name, path in MODELS.items():
    try:
        print(f"🔧 Converting {name} ({path})…")
        model = joblib.load(path)
        initial_type = [('float_input', FloatTensorType([None, INPUT_FEATURES]))]
        # Opset 13 is well supported by onnxruntime-web
        onnx_model = convert_sklearn(model, initial_types=initial_type, target_opset=13)
        output_path = f"models/{name}.onnx"
        with open(output_path, "wb") as f:
            f.write(onnx_model.SerializeToString())
        print(f"✅ {name} saved to {output_path}")
    except Exception as e:
        print(f"❌ Failed to convert {name}: {e}")