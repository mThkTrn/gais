import sys
import cv2
import numpy as np
import pyautogui
from time import time, sleep

# Configuration
SMOOTHING_FACTOR = 0.2    # Lower = smoother but more lag
MOVE_SCALE = 2.0          # Scale factor for mouse movement
BLINK_DURATION = 0.4       # Seconds to count as a click

# Safe-fail and speed
pyautogui.FAISE = False    # Disable the failsafe
pyautogui.PAUSE = 0        # Remove delay after pyautogui functions

class FaceTracker:
    def __init__(self):
        # Initialize face detection
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )
        self.eye_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_eye.xml'
        )
        
        # Initialize webcam
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            print("Error: Could not open webcam")
            sys.exit(1)
            
        # Get screen size
        self.screen_w, self.screen_h = pyautogui.size()
        
        # State
        self.last_blink_time = 0
        self.blink_start = 0
        self.eyes_closed = False
        self.last_face_position = None
        self.smoothed_x, self.smoothed_y = self.screen_w // 2, self.screen_h // 2
        self.click_triggered_left = False
        self.click_triggered_right = False
        self.calibrated = False
        
        # Smoothing State
        self.smooth_x = 0
        self.smooth_y = 0
        self.last_mouse_x = 0
        self.last_mouse_y = 0
        
    def detect_face_and_eyes(self, frame):
        """Detect face and eyes in the frame"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(gray, 1.3, 5)
        
        face_rect = None
        eyes = []
        
        for (x, y, w, h) in faces:
            face_rect = (x, y, w, h)
            roi_gray = gray[y:y+h, x:x+w]
            roi_color = frame[y:y+h, x:x+w]
            
            # Detect eyes within the face region
            detected_eyes = self.eye_cascade.detectMultiScale(roi_gray)
            for (ex, ey, ew, eh) in detected_eyes:
                eyes.append((x + ex, y + ey, ew, eh))
                
        return face_rect, eyes
    
    def update_mouse_position(self, face_rect):
        """Update mouse position based on face position"""
        if face_rect is None:
            return
            
        x, y, w, h = face_rect
        face_center_x = x + w // 2
        face_center_y = y + h // 2
        
        # Map face position to screen coordinates
        frame_h, frame_w = self.cap.get(4), self.cap.get(3)
        target_x = (face_center_x / frame_w) * self.screen_w
        target_y = (face_center_y / frame_h) * self.screen_h
        
        # Apply smoothing
        self.smoothed_x = self.smoothed_x * (1 - SMOOTHING_FACTOR) + target_x * SMOOTHING_FACTOR
        self.smoothed_y = self.smoothed_y * (1 - SMOOTHING_FACTOR) + target_y * SMOOTHING_FACTOR
        
        # Move mouse
        try:
            pyautogui.moveTo(
                int(self.smoothed_x * MOVE_SCALE),
                int(self.smoothed_y * MOVE_SCALE)
            )
        except Exception as e:
            print(f"Error moving mouse: {e}")
    
    def handle_blink(self, eyes):
        """Handle blink detection for mouse clicks"""
        current_time = time()
        
        if len(eyes) < 2:  # Eyes not detected (blinking)
            if not self.eyes_closed:
                self.blink_start = current_time
                self.eyes_closed = True
            else:
                # Check for long press
                if current_time - self.blink_start > BLINK_DURATION:
                    if not self.click_triggered_left:
                        pyautogui.mouseDown(button='left')
                        self.click_triggered_left = True
        else:  # Eyes open
            if self.eyes_closed:
                self.eyes_closed = False
                blink_duration = current_time - self.blink_start
                
                # Handle click release
                if self.click_triggered_left:
                    pyautogui.mouseUp(button='left')
                    self.click_triggered_left = False
                # Handle single click
                elif blink_duration < BLINK_DURATION:
                    pyautogui.click()
                
                self.last_blink_time = current_time
    
    def run(self):
        """Main tracking loop"""
        print("Starting face tracker. Press 'q' to quit.")
        
        try:
            while True:
                ret, frame = self.cap.read()
                if not ret:
                    print("Failed to grab frame")
                    break
                    
                # Flip frame horizontally for a more intuitive mirror-like experience
                frame = cv2.flip(frame, 1)
                
                # Detect face and eyes
                face_rect, eyes = self.detect_face_and_eyes(frame)
                
                # Update mouse position if face is detected
                if face_rect is not None:
                    self.update_mouse_position(face_rect)
                    
                    # Draw face rectangle
                    x, y, w, h = face_rect
                    cv2.rectangle(frame, (x, y), (x+w, y+h), (255, 0, 0), 2)
                
                # Handle blinks for clicks
                self.handle_blink(eyes)
                
                # Display the frame (for debugging)
                for (ex, ey, ew, eh) in eyes:
                    cv2.rectangle(frame, (ex, ey), (ex+ew, ey+eh), (0, 255, 0), 2)
                
                cv2.imshow('Face Tracker', frame)
                
                # Exit on 'q' key
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break
                    
        except KeyboardInterrupt:
            print("\nShutting down...")
        finally:
            self.cap.release()
            cv2.destroyAllWindows()
            print("Tracker stopped.")

if __name__ == "__main__":
    tracker = FaceTracker()
    tracker.run()

            except Exception as e:
                sys.stderr.write(f"Calibration failed: {e}\n")
            
            finally:
                # Re-initialize camera after calibration
                if not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(0)
                    if not self.cap.isOpened():
                        sys.stderr.write("Critical: Failed to re-open camera after calibration.\n")
                
                # Signal calibration end
                print(json.dumps({"type": "calibration_event", "status": "end"}))
                sys.stdout.flush()


    def calculate_ear(self, landmarks, indices, w, h):
        points = [np.array([landmarks[i].x * w, landmarks[i].y * h]) for i in indices]
        v1 = np.linalg.norm(points[1] - points[5])
        v2 = np.linalg.norm(points[2] - points[4])
        h_dist = np.linalg.norm(points[0] - points[3])
        if h_dist == 0: return 0.0
        return (v1 + v2) / (2.0 * h_dist)

    def run(self):
        # Removed auto-calibration
        # if EYETRAX_AVAILABLE and self.estimator:
        #     self.calibrate()

        screen_w, screen_h = pyautogui.size()

        while True:
            # Handle Calibration Request on Main Thread (CV2 GUI needs main thread often)
            if self.calibration_requested:
                self.calibrate()
                self.calibration_requested = False

            success, image = self.cap.read()
            if not success:
                time.sleep(0.01)
                continue

            h, w, _ = image.shape
            
            # 1. Gaze Tracking
            gaze_x, gaze_y = 0, 0
            if EYETRAX_AVAILABLE and self.estimator:
                try:
                    features, blink = self.estimator.extract_features(image)
                    if features is not None and not blink and self.calibrated:
                        pred = self.estimator.predict([features])
                        raw_x, raw_y = pred[0]
                        
                        # Apply smoothing (Exponential Moving Average)
                        if self.smooth_x == 0 and self.smooth_y == 0:
                            self.smooth_x, self.smooth_y = raw_x, raw_y
                        else:
                            self.smooth_x = self.smooth_x * (1 - SMOOTHING_FACTOR) + raw_x * SMOOTHING_FACTOR
                            self.smooth_y = self.smooth_y * (1 - SMOOTHING_FACTOR) + raw_y * SMOOTHING_FACTOR
                        
                        gaze_x, gaze_y = int(self.smooth_x), int(self.smooth_y)
                        
                        # Move Mouse ONLY if active and outside deadzone
                        if self.tracking_active:
                            dx = abs(gaze_x - self.last_mouse_x)
                            dy = abs(gaze_y - self.last_mouse_y)
                            
                            if dx >= DEADZONE or dy >= DEADZONE:
                                pyautogui.moveTo(gaze_x, gaze_y)
                                self.last_mouse_x, self.last_mouse_y = gaze_x, gaze_y
                    else:
                         # sys.stderr.write("Features None or Blink detected\n")
                         pass
                except Exception as e:
                    sys.stderr.write(f"Gaze error: {e}\n")
            
            # 2. Blink Detection
            image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            image_rgb.flags.writeable = False
            results = self.face_mesh.process(image_rgb)
            
            blink_left = False
            blink_right = False
            ear_left = 0.0
            ear_right = 0.0
            
            if results.multi_face_landmarks:
                for face_landmarks in results.multi_face_landmarks:
                    lm = face_landmarks.landmark
                    ear_left = self.calculate_ear(lm, [33, 160, 158, 133, 153, 144], w, h)
                    ear_right = self.calculate_ear(lm, [362, 385, 387, 263, 373, 380], w, h)
                    
                    if ear_left < EAR_THRESHOLD: blink_left = True
                    if ear_right < EAR_THRESHOLD: blink_right = True

            # 3. Process Clicks ONLY if active
            if self.tracking_active:
                curr_time = time.time()
                
                # Left Click Logic
                if blink_left:
                    if self.blink_start_left == 0:
                        self.blink_start_left = curr_time
                    elif (curr_time - self.blink_start_left) > LONG_BLINK_DURATION:
                        if not self.click_triggered_left:
                            pyautogui.click(button='left')
                            self.click_triggered_left = True
                            sys.stderr.write("Left Click\n")
                else:
                    self.blink_start_left = 0
                    self.click_triggered_left = False
                
                # Right Click Logic
                if blink_right:
                    if self.blink_start_right == 0:
                        self.blink_start_right = curr_time
                    elif (curr_time - self.blink_start_right) > LONG_BLINK_DURATION:
                        if not self.click_triggered_right:
                            pyautogui.click(button='right')
                            self.click_triggered_right = True
                            sys.stderr.write("Right Click\n")
                else:
                    self.blink_start_right = 0
                    self.click_triggered_right = False

            # 4. Output Data for UI
            payload = {
                "x": float(gaze_x),
                "y": float(gaze_y),
                "blink_left": self.click_triggered_left,
                "blink_right": self.click_triggered_right,
                "raw_ear_left": ear_left,
                "raw_ear_right": ear_right,
                "active": self.tracking_active
            }
            
            print(json.dumps(payload))
            sys.stdout.flush()

if __name__ == "__main__":
    tracker = EyeTracker()
    tracker.run()
