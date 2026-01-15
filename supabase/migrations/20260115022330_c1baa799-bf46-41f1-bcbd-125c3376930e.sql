-- Harden handle_new_user function with input validation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER 
SET search_path = public
AS $$
DECLARE
  v_full_name TEXT;
BEGIN
  -- Validate and sanitize full_name from user metadata
  v_full_name := TRIM(COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  
  -- Limit length to 255 characters
  IF LENGTH(v_full_name) > 255 THEN
    v_full_name := SUBSTRING(v_full_name, 1, 255);
  END IF;
  
  -- Insert profile with sanitized data
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (NEW.id, NULLIF(v_full_name, ''), NEW.email);
  
  -- Insert default role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'investor');
  
  -- Initialize investment account
  INSERT INTO public.investments (user_id, balance)
  VALUES (NEW.id, 0);
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log warning but don't fail user creation
  RAISE WARNING 'Error in handle_new_user for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Harden generate_referral_code function with iteration limit
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  max_attempts INT := 100;
  attempt INT := 0;
BEGIN
  LOOP
    attempt := attempt + 1;
    
    -- Prevent infinite loop - fail after max attempts
    IF attempt > max_attempts THEN
      RAISE EXCEPTION 'Unable to generate unique referral code after % attempts', max_attempts;
    END IF;
    
    -- Generate random 8-character code
    new_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = new_code) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  NEW.referral_code := new_code;
  RETURN NEW;
END;
$$;

-- Add CHECK constraints for financial amount validation on deposits
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'deposits_amount_valid'
  ) THEN
    ALTER TABLE public.deposits ADD CONSTRAINT deposits_amount_valid 
      CHECK (amount > 0 AND amount <= 1000000000);
  END IF;
END $$;

-- Add CHECK constraints for withdrawals
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'withdrawals_amount_valid'
  ) THEN
    ALTER TABLE public.withdrawals ADD CONSTRAINT withdrawals_amount_valid 
      CHECK (amount > 0 AND amount <= 1000000000);
  END IF;
END $$;

-- Add CHECK constraints for investments balance
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'investments_balance_valid'
  ) THEN
    ALTER TABLE public.investments ADD CONSTRAINT investments_balance_valid 
      CHECK (balance >= 0 AND balance <= 1000000000);
  END IF;
END $$;

-- Add CHECK constraints for transactions amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'transactions_amount_valid'
  ) THEN
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_amount_valid 
      CHECK (amount >= -1000000000 AND amount <= 1000000000);
  END IF;
END $$;

-- Add CHECK constraints for active_investments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints 
    WHERE constraint_name = 'active_investments_amount_valid'
  ) THEN
    ALTER TABLE public.active_investments ADD CONSTRAINT active_investments_amount_valid 
      CHECK (principal_amount > 0 AND principal_amount <= 1000000000);
  END IF;
END $$;